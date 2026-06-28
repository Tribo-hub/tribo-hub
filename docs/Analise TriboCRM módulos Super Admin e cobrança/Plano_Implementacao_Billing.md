# Plano de Implementação — Billing / Super Admin / Parceiros (Tribo Hub)

Plano **faseado e aditivo** (não remove/renomeia nada existente), validado contra o código real.
Decisões de negócio incorporadas:
1. Inadimplência: **15 dias** bloqueia painel do produtor/empresa; **30 dias** bloqueia também os alunos.
2. Aquisição: **autoatendimento** (compra direto após o pop-up) **e** criação manual pelo Super Admin.
3. Pagamento: **Pix + Boleto + Cartão recorrente** (Efí).
4. **Parceiros/afiliados** com a mesma ideia/tela do TriboCRM.
5. **Trial manual** — o Super Admin define os dias por conta (não é automático).

## Princípios transversais
- Prisma só **adiciona** (colunas nuláveis / tabelas / valores de enum). `ALTER TYPE ADD VALUE` em **migração isolada** (não roda em transação). Enums/valores atuais permanecem.
- Idempotência no que o webhook toca; anti-corrida com `updateMany` + guarda de status; fire-and-forget no secundário (e-mail/comissão); banco é a fonte da verdade (Efí é best-effort).
- Reaproveitar o que já existe: `FaturaPlataforma` = "Charge"; webhook Efí = `processarWebhookEfi`. Régua de preço continua **base + aluno ativo / assentos** (não copiar plano fixo do TriboCRM).

---

## FASE 1 — Ciclo de vida da fatura + suspensão (15/30d) + HMAC no webhook
**Schema (aditivo):** `AssinaturaPlataforma` += `inadimplenteDesde`, `ultimoEstadoBilling`, `ultimoEstadoBillingEm`, `painelBloqueado`(bool), `alunosBloqueados`(bool). `FaturaPlataforma` += `vencimentoEm`, `metodoPagamento`. Enums: `StatusFatura += vencida`, `StatusAssinatura += inadimplente` (migração isolada).
**API:** `emitirCobrancaAoFechar` (gera Pix ao fechar + define vencimento); `processarCicloVida(hoje)` = máquina de estados diária idempotente (fatura emitida → D-3/D-1 → vencida/inadimplente → 15d painel → 30d alunos), e-mail antes do update, `updateMany` com guarda; `reativarPorPagamento` chamado por `confirmarPagamentoPorTxid` e `marcarPaga` (destrava o tenant). HMAC **opt-in** no webhook (só valida se `EFI_WEBHOOK_HMAC` setada).
**Cron:** `daily` chama `processarCicloVida` todo dia; no dia 1, após `fecharTodas`, emite as cobranças.
**Guard:** novo `SubscriptionStatusGuard` por escopo — painel (`admin_tenant`) bloqueia se `painelBloqueado`; aluno bloqueia se `alunosBloqueados`; `super_admin` faz bypass; cache curto por conta.
**Front:** painel mostra tela "regularize" (com Pix da fatura) no 403; Super Admin/Faturamento ganha coluna de status do ciclo + vencimento.
**Envs (opcionais):** `EFI_WEBHOOK_HMAC`, `BILLING_DIAS_VENCIMENTO=7`, `BILLING_SUSPENSAO_PAINEL_DIAS=15`, `BILLING_SUSPENSAO_ALUNOS_DIAS=30`.
**Riscos/mitigação:** guard só bloqueia via flags materializadas pela máquina (nascem false); HMAC opt-in; migração de enum isolada. Testar com `hoje` parametrizável + endpoint interno por `CRON_SECRET` em staging.

## FASE 2 — Super Admin financeiro + descontos/cupons/avulsa/notas + catálogo
**Schema:** `AssinaturaPlataforma` += desconto (`descontoTipo/Valor/Ate/Ciclos/Motivo`). Novas tabelas `NotaConta`, `CupomPlataforma`, `PlanoCatalogo` (+ `AssinaturaPlataforma.planoCatalogoId?`, mantendo `plano` string). `FaturaPlataforma` += `avulsa`(bool), `descontoValor`, `observacao`.
**API:** dashboard financeiro (MRR/ARR/churn/ticket/inadimplência/MRR 6m/alertas — sobre dados existentes); desconto por conta (aplicado no `calcular`/`fecharFatura`); cobrança avulsa; notas; CRUD de cupons e de catálogo.
**Front:** `admin/financeiro`, seções em `admin/contas/detalhe` (desconto/notas/avulsa), `admin/cupons`, `admin/planos-catalogo`.
**Risco:** `@@unique([contaId,competencia])` × avulsa → usar competência sintética. Desconto só vale na próxima competência (fatura paga não recalcula).

## FASE 3 — Autoatendimento: signup do produtor + trial manual + checkout Pix/Boleto/Cartão
**Schema:** `AssinaturaPlataforma` += `trialAte`, `metodoPreferido`, cartão recorrente (`efiSubscriptionId/Status`, `cartaoUltimos4/Bandeira`, `proximaCobrancaEm`). `Conta` += `origemCadastro`. `FaturaPlataforma` += `boletoUrl`, `efiChargeId`.
**API:** `POST /public/signup-produtor` (cria Conta+admin+assinatura; trial só se concedido); `EfiService` ganha **boleto** e **cartão recorrente** (host de cobranças próprio, sem mexer no Pix); `processarWebhookEfi` estendido p/ os 3 formatos (Pix/Boleto/Cartão) terminando na confirmação por `efiChargeId`.
**Front:** página `assinar` (modo → resumo da régua → checkout; cartão tokeniza no front via SDK Efí). CTA da landing aponta pro fluxo.
**Envs:** `EFI_PLAN_ID_MENSAL/ANUAL`, host de cobranças boleto/cartão.

## FASE 4 — Parceiros / afiliados (comissões progressivas)
**Schema:** `Parceiro`, `ComissaoParceiro` (`faturaId @unique`, status pendente/disponivel/paga/revertida, `disponivelEm`), `TrocaParceiroConta`; `Conta` += `referidoPorParceiroId`, `referidoEm`.
**API:** motor de comissão na confirmação de pagamento (fire-and-forget, `faturaId` único = idempotente, taxa pela faixa, carência 30d); cron `promoverComissoes`; Super Admin CRUD + relatório de payout + marcar paga (bulk); anti auto-indicação.
**Front:** `admin/parceiros` (+ detalhe), tiers, comissões, payout. Signup lê `?ref=PRTxxxx`.
**Env:** `COMISSAO_CARENCIA_DIAS=30` (opcional).

---

## Ordem e dependências
1 → 2 → 3 → 4 (Fase 1 é base de tudo). A parte read-only da Fase 2 (dashboard) pode ir junto da Fase 1. Fase 4 pode ter CRUD/atribuição manual sem a Fase 3.

## Arquivos-chave
- `packages/db/prisma/schema.prisma` (migrações aditivas)
- `apps/api/src/billing/{billing.service,billing.controller,efi.service}.ts`
- `apps/api/src/cron.ts`
- `apps/api/src/common/guards/` (novo `SubscriptionStatusGuard`)
- `packages/config/src/env.ts` (novas envs opcionais)
- `apps/web/app/admin/*` e `apps/web/app/painel/*` (telas)

*Plano gerado com o arquiteto a partir do blueprint do TriboCRM + leitura do código atual. Aditivo e não-destrutivo. Nada implementado ainda.*
