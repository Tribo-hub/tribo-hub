# Módulo de Pagamento do TriboCRM — Blueprint Completo

> Documento de referência para replicar o sistema de billing/pagamento/parceiros em outro projeto.
> Extraído do código real do TriboCRM em 2026-06-14. Stack: Node + Express + Prisma + Postgres (Supabase). Gateway: **Efí (Efí Pay / ex-Gerencianet)**.

---

## 0. Visão geral em uma frase

Um cliente faz signup escolhendo plano + ciclo + método de pagamento e entra em **trial de 30 dias**. Uma **máquina de estados diária** avisa por e-mail conforme o trial vai vencendo, gera a cobrança (PIX/Boleto) e, se não pagar, marca atraso e suspende. O **gateway Efí** confirma pagamento via **webhook**, que ativa o tenant e estende a validade. Quem indicou o cliente (**parceiro**) ganha **comissão recorrente** a cada cobrança paga, liberada após 30 dias de carência. O **Super Admin** tem painel para tudo: planos, cupons, descontos, cobranças manuais, relatório financeiro (MRR/ARR/churn) e gestão de parceiros/comissões.

---

## 1. Arquitetura de dados (o esquema)

Toda a lógica de billing assenta em poucas tabelas. O ponto mais importante de design: **os campos de assinatura ficam no próprio `Tenant`** (não há tabela `Subscription` separada). Cada cobrança individual vira uma linha em `Charge`.

### 1.1 `Plan` — catálogo de planos
Campos-chave: `slug` (único), `priceMonthly`, `priceYearly`, `extraUserPrice`, e os limites: `maxUsers`, `maxLeads`, `maxPipelines`, `maxAutomations`, `maxForms`, `maxCustomFields`, `maxEmailTemplates`, `maxWhatsappTemplates`, mais `features` (JSON com flags booleanas) e `isActive`.

> Decisão: limites são colunas no plano, não regras espalhadas no código. Trocar o plano = trocar os números.

### 1.2 `Tenant` — a conta do cliente (carrega o estado da assinatura)
Além dos dados cadastrais, guarda:
- **Assinatura:** `planId` (FK), `planCycle` (`MONTHLY`/`YEARLY`), `status` (`TRIAL`/`ACTIVE`/`PAYMENT_OVERDUE`/`SUSPENDED`/`CANCELLED`), `trialEndsAt`, `planStartedAt`, `planExpiresAt`, `preferredPaymentMethod` (`PIX`/`BOLETO`/`CREDIT_CARD`).
- **Desconto recorrente:** `discountType`, `discountValue`, `discountFrom`, `discountUntil`, `discountCycles`, `discountReason`.
- **Cartão recorrente (Efí):** `efiSubscriptionId`, `efiSubscriptionStatus`, `cardLastFour`, `cardBrand`, `cardExpiresAt`, `nextBillingAt`.
- **Máquina de estados de billing:** `lastBillingState`, `lastBillingStateAt` (marcadores de idempotência — ver §4).
- **Parceiro:** `referredByPartnerId` (FK, NULL = veio direto), `referredAt`.

### 1.3 `Charge` — cada cobrança individual
`id`, `tenantId`, `efiChargeId`, `efiSubscriptionId`, `amount`, `discountValue`, `dueDate`, `paidAt`, `paymentMethod` (`PIX`/`BOLETO`/`CREDIT_CARD`/`MANUAL`), `status` (`PENDING`/`PAID`/`OVERDUE`/`CANCELLED`), `referenceMonth` (`"YYYY-MM"` — usado nos relatórios), `boletoUrl`, `pixCopiaECola`, `note`.

### 1.4 `Coupon` — cupons de desconto
`code` (único), `discountType` (PERCENTAGE/FIXED), `discountValue`, `applicablePlans` (array de slugs), `maxUses`, `maxUsesPerUser`, `usedCount`, `validFrom`/`validUntil`, `durationType` (`FIRST` = só 1º mês / `EVERY` = recorrente), `durationMonths`, `isActive`. Soft-delete (vira `isActive=false`).

### 1.5 Programa de parceiros (3 tabelas)
- **`Partner`** — o afiliado/agência. `code` único (`PRT` + 8 hex), `commissionTiers` (JSON de faixas progressivas), `commissionRate` (legado), dados bancários para payout manual (`pixKey`, `bankName`, `bankBranch`, `bankAccount`, `bankAccountType`), `isActive`.
- **`PartnerCommission`** — uma linha por cobrança paga de cliente indicado. `chargeId` **único** (idempotência), `amount`, `rate` (congelado no momento), `commission` (= amount × rate / 100), `status` (`PENDING`/`AVAILABLE`/`PAID`/`REVERSED`), `availableAt` (= paidAt + 30 dias). Índices: `[partnerId, status]`, `[status, availableAt]`, `[tenantId]`.
- **`TenantPartnerChange`** — auditoria de troca de parceiro. `oldPartnerId`/`newPartnerId`, `changedBy`, `source` (`signup_cookie`/`gestor_ui`/`super_admin`).

> Três decisões de design importantes nas comissões:
> 1. **`chargeId` único** garante "uma comissão por cobrança" mesmo se o webhook chegar 2x.
> 2. **`rate` é congelado** — mudar a tabela do parceiro depois não altera comissões já criadas.
> 3. **Carência de 30 dias** (`availableAt`) protege contra reembolso/chargeback antes de liberar o saque.

---

## 2. Gateway de pagamento (Efí)

**Arquivo central:** `backend/src/services/efi.service.ts`. SDK oficial `sdk-typescript-apis-efi`.

**Configuração (env vars):** `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_SANDBOX`, `EFI_PIX_KEY`, `EFI_WEBHOOK_URL`, `EFI_WEBHOOK_HMAC`, `EFI_PLAN_ID_MONTHLY`, `EFI_PLAN_ID_YEARLY`.

**Autenticação mTLS:** certificado `.p12` carregado de `backend/certs/` (ou via Base64 em env var `EFI_*_CERT_BASE64` para deploy no Railway — porque não dá pra subir arquivo binário).

**Três métodos de pagamento:**

| Método | Função no service | Retorna | Natureza |
|---|---|---|---|
| PIX | `createPixCharge()` | `txid`, `pixCopiaECola`, `expiresAt` | Cobrança imediata, expira (default 30 min, billing usa 7 dias) |
| Boleto | `createBoletoCharge()` | `chargeId`, `boletoUrl`, `barCode`, `dueDate` | Suporta PF (11 díg) e PJ (14 díg, bloco `juridical_person`) |
| Cartão | `createCardSubscription()` | `subscriptionId`, `chargeId`, `status`, `nextBillingAt` | **Assinatura recorrente** gerenciada pela Efí |

Detalhes importantes:
- O **cartão usa planos pré-criados na Efí** (`EFI_PLAN_ID_MONTHLY`/`YEARLY`). O frontend tokeniza o cartão (`paymentToken`), o backend cria a subscription via `efi.oneStepSubscription()` contra o plano. Cancelamento via `cancelCardSubscription()` é *best-effort* (falha na Efí não trava o cancelamento local).
- PIX/Boleto são cobranças avulsas — a recorrência deles é **o nosso job que gera nova cobrança**, não a Efí.

---

## 3. Fluxos de API (o que codamos)

### 3.1 Signup (`POST /public/signup` — `signup.controller.ts`)
Transação atômica cria: Tenant (status `TRIAL`, `trialEndsAt = now + 30d`), User OWNER (bcrypt 12 rounds), pipeline default com estágios. Pós-transação *fire-and-forget*: vincula parceiro se `referralCode` válido, envia e-mail de boas-vindas. Valida documento (CPF/CNPJ com dígito verificador) e e-mail único global.

### 3.2 Pagamentos (`payments.routes.ts`)
| Rota | Método | Auth | O que faz |
|---|---|---|---|
| `/payments/plans` | GET | público | Lista planos ativos |
| `/payments/pix` | POST | OWNER/MANAGER | Gera cobrança PIX, salva `Charge` PENDING |
| `/payments/boleto` | POST | OWNER/MANAGER | Gera boleto, salva `Charge` PENDING |
| `/payments/card-subscription` | POST | OWNER | Cria assinatura no cartão (transação: atualiza tenant + cria charge) |
| `/payments/cancel` | POST | OWNER | Cancela assinatura (best-effort Efí + status `CANCELLED`) |
| `/payments/upgrade` | POST | OWNER | Upgrade com **valor prorateado** (`(diasRestantes/30) × diferença`); rejeita downgrade; **não troca o plano até pagar** |
| `/payments/history` | GET | JWT | Últimas 20 cobranças |
| `/payments/:txid/status` | GET | JWT | Status da cobrança (lê do banco, não da Efí) |

> Padrão de upgrade que vale copiar: cria a cobrança da diferença prorateada, e a troca efetiva do plano só acontece quando o pagamento confirma via webhook. Nada de "mudar primeiro, cobrar depois".

### 3.3 Webhooks (`webhooks.routes.ts`) — o coração da confirmação
**Segurança em 3 camadas:** (1) HMAC via query param `?hmac=`, comparado com `timingSafeEqual` (constant-time); (2) IP allowlist da Efí (só em produção); (3) GET/HEAD respondem 200 sem auth (a Efí faz "probe" antes de registrar o webhook).

**Três formatos de payload tratados:**
- **PIX:** array `{ pix: [{ txid }] }` → `processWebhookPayment(txid)` para cada.
- **Boleto:** `{ charge: { id, status } }` → se `status === 'paid'`, processa.
- **Assinatura (cartão):** `{ notification: <token opaco> }` → resolve via `efi.getNotification(token)`, mapeia status, e em renovações cria nova `Charge`.

**`processWebhookPayment()` (idempotente):**
1. Acha charge por `efiChargeId`; se já `PAID`, retorna (idempotência).
2. Marca `status=PAID`, `paidAt=now`.
3. *Fire-and-forget:* cria `PartnerCommission` se houver parceiro.
4. Ativa tenant: `status=ACTIVE`, estende `planExpiresAt` (+30 ou +365 dias por ciclo).
5. Limpa `lastBillingState` (reseta a máquina de e-mails).

> O webhook **sempre responde 200 na hora** e processa assíncrono — a Efí não fica esperando.

---

## 4. Automação (jobs diários via cron)

| Job | Horário | O que faz |
|---|---|---|
| **`billing-state-machine.job.ts`** | 09:30 | A máquina de estados principal (ver abaixo) |
| `overdue-charges.job.ts` | 09:00 | Cria *notificação in-app* para tenants com trial vencido ou cobrança em aberto |
| `expiry-alert.job.ts` | 11:00 | Avisa (notificação + e-mail) tenants ACTIVE cujo plano vence em ≤3 dias |
| `commission-availability.job.ts` | 04:30 | Promove comissões `PENDING → AVAILABLE` quando passa a carência de 30 dias |

### 4.1 A máquina de estados de billing (a peça mais valiosa de copiar)
Roda 1×/dia. Idempotência ancorada em `tenant.lastBillingState` (string marcadora) — se já enviou o e-mail daquele estágio, pula.

**Trilha TRIAL (antes de vencer):**
- **D-7:** e-mail "faltam 7 dias".
- **D-3:** **gera a cobrança** (PIX com 7 dias de validade, ou Boleto com vencimento = fim do trial + 7d) + e-mail "faltam 3 dias". *Cartão é pulado* — quem é cartão tem cobrança automática pela Efí.
- **D-1:** e-mail "falta 1 dia".

**Trilha OVERDUE (depois de vencer):**
- **D+0:** transição `TRIAL → PAYMENT_OVERDUE` + e-mail "pagamento em atraso".
- **D+7:** e-mail "última oportunidade".
- **D+10:** transição `PAYMENT_OVERDUE → SUSPENDED` + e-mail "conta suspensa".

**Quando paga:** o webhook limpa `lastBillingState` e o tenant volta para `ACTIVE` — a máquina recomeça do zero no próximo ciclo.

**Anti race-condition:** usa `updateMany` com guarda de status. Se o cliente pagou entre a leitura e o update, o count volta 0 e o estado não regride. O e-mail é enviado *antes* do update de propósito (se o update falhar por corrida, o e-mail já está registrado no provedor).

**E-mails:** templates transacionais no **Brevo (Sendinblue)**, IDs em `backend/src/config/billing-templates.ts`. Variáveis: nome, plano, valor, método, data de vencimento, dias restantes, links.

---

## 5. Controle de acesso por plano

- **`tenant-status.middleware.ts`** (global): bloqueia (403) se `SUSPENDED` ("conta suspensa por falta de pagamento") ou `CANCELLED`. `SUPER_ADMIN` faz bypass. Cache in-memory de 30s por tenant para não bater no banco toda request.
- **Limites de uso:** checados nos controllers ao criar recurso. Ex: `POST /users` conta usuários ativos vs `plan.maxUsers` e retorna 403 + notifica os OWNERs ao estourar. (A validação é por-controller, não um middleware central.)
- **Rate limit da API pública v1:** `api-key-rate-limit.middleware.ts` — 60 req/min e 1000 req/h, in-memory, com headers `X-RateLimit-*`.

---

## 6. Acessos do Super Admin (`admin.routes.ts` + `admin.controller.ts`, guard `adminOnly`)

### Dashboard e tenants
- `GET /admin/dashboard` — KPIs: **MRR** (soma charges PAID do mês), **ARR** (×12), novos tenants no mês, inadimplentes; histórico de MRR de 6 meses; alertas (overdue + trials vencendo).
- `GET /admin/tenants` — lista paginada com busca (nome/email/cnpj), filtros por status/plano, stats por status.
- `GET /admin/tenants/:id` — detalhe completo (plano, usuários, últimas 20 charges, notas internas).
- `PATCH /admin/tenants/:id` — edita status, **troca plano manualmente**, estende trial, dados cadastrais, notas internas.

### Cobranças manuais
- `POST /admin/tenants/:id/charge` — cria cobrança manual (PIX/Boleto) com desconto.
- `PATCH /admin/charges/:id` — marca como PAID/CANCELLED, aplica desconto, registra pagamento manual (`MANUAL`).
- `POST /admin/charges/:id/retry` — regera cobrança.

### Relatório financeiro
- `GET /admin/financial?period=...` — MRR, ARR, contagem de overdue, **churn rate** (cancelados/ativos ×100), **ticket médio** (MRR/ativos), lista de cobranças filtradas por período/status/plano/tenant.

### Planos e cupons
- `GET /admin/plans`, `PATCH /admin/plans/:id/price` — edita preços.
- `GET/POST/PATCH/DELETE /admin/coupons` — CRUD de cupons (delete é soft).

### Descontos e notas por tenant
- `POST /admin/tenants/:id/discount` — desconto fixo ou % por N ciclos, com motivo.
- `POST/DELETE /admin/tenants/:id/notes` — notas internas (suporte/financeiro).

### Execução manual de job
- `POST /admin/jobs/billing-state-machine/run` — dispara a máquina de estados sob demanda (retorna 202, roda em background). Útil pra testar sem esperar o cron.

### Parceiros e comissões (`partners.routes.ts`)
- `GET /admin/partners` — lista com `activeClientsCount` e totais (pending/available/paid).
- `GET /admin/partners/:id` — detalhe + tenants indicados + últimas 200 comissões.
- `POST/PATCH /admin/partners[/:id]` — CRUD (auto-gera `code`). `DELETE` só se não tiver comissões (senão, desativar).
- `GET /admin/partners/commissions-report?month=YYYY-MM` — relatório agrupado por parceiro, com dados bancários para o payout.
- `POST /admin/partners/commissions/:id/mark-paid` e `.../bulk-mark-paid` — marca `AVAILABLE → PAID` (até 200 por vez).

---

## 7. Esquema de indicação (passo a passo)

```
1. CADASTRO        Super Admin → POST /admin/partners → gera código PRT######## + tiers
2. INDICAÇÃO       Landing ?ref=PRTxxxx → cookie no front → signup envia referralCode
                   → valida (existe, ativo, NÃO é auto-indicação por CNPJ/email)
                   → grava tenant.referredByPartnerId + TenantPartnerChange(signup_cookie)
3. COBRANÇA PAGA   Webhook PAID → createCommissionForCharge() [fire-and-forget]
                   → rate pela faixa atual (conta clientes ACTIVE do parceiro)
                   → commission = amount × rate / 100; status=PENDING; availableAt=+30d
4. CARÊNCIA        Job diário 04:30 → PENDING → AVAILABLE quando passa 30 dias
5. PAYOUT          Super Admin vê relatório → paga manual (PIX/TED) → marca PAID
```

**Comissão progressiva (tiers):** ex. até 5 clientes ativos = 15%, até 19 = 20%, 20+ = 25%. "Cliente ativo" = tenant com `status=ACTIVE` (exclui trial/atrasado/suspenso/cancelado).

**Atribuição last-touch com histórico:** o gestor pode trocar de parceiro depois (`POST /tenant-partner`), mas `referredAt` preserva a data do **primeiro** vínculo; toda troca vira linha em `TenantPartnerChange` para auditoria.

**Anti-fraude:** `validateNotSelfReferral()` compara documento (só dígitos) e e-mail (case-insensitive) do tenant vs parceiro — bloqueia usar o próprio código.

**Recorrência vitalícia:** comissão é gerada **a cada cobrança paga**, enquanto cliente E parceiro estiverem ativos. Sem reversão depois da carência.

---

## 8. Relatórios

- **Financeiro do admin** (`GET /admin/financial`): MRR, ARR, overdue, churn, ticket médio, por período.
- **Dashboard do admin** (`GET /admin/dashboard`): KPIs + MRR de 6 meses + alertas.
- **Comissões** (`GET /admin/partners/commissions-report`): agrupado por parceiro/mês/status, com dados bancários.
- **Gestão do tenant** (`reports.controller.ts → getGestaoReports()`): receita por leads ganhos, conversão, ticket médio, desempenho por vendedor, motivos de perda. (Esse é relatório de vendas do cliente, não de billing.)

> Base de todos os relatórios financeiros: `referenceMonth` ("YYYY-MM") nas charges + agregação por `status='PAID'`.

---

## 9. Princípios de design que valem replicar

1. **Estado da assinatura mora no tenant**, cobranças individuais em `Charge`. Simples, sem tabela de subscription duplicando estado.
2. **Idempotência em tudo que o webhook toca**: charge já-PAID retorna cedo; comissão tem `chargeId` único; máquina de estados usa marcador `lastBillingState`.
3. **Fire-and-forget para o secundário**: criar comissão ou enviar e-mail nunca pode quebrar o pagamento ou o signup.
4. **Best-effort no gateway**: cancelar/atualizar na Efí pode falhar sem travar o estado local — a fonte da verdade é o nosso banco.
5. **Troca de plano só efetiva no pagamento confirmado** (nada de liberar antes).
6. **Valores congelados** onde retroatividade seria injusta (rate de comissão).
7. **Carência protege o caixa** (30 dias antes de liberar comissão; cobre reembolso/chargeback).
8. **Máquina de estados desacopla aviso, cobrança e suspensão** num único job diário idempotente — fácil de auditar e re-rodar.
9. **Anti race webhook-vs-job** com `updateMany` + guarda de status.
10. **Payout manual** — o sistema calcula e organiza, mas a transferência ao parceiro é feita a mão (sem integração bancária de saída), reduzindo risco e escopo.

---

## 10. Arquivos-mapa (onde está cada coisa)

| Área | Arquivo |
|---|---|
| Schema | `backend/prisma/schema.prisma` |
| Gateway Efí | `backend/src/services/efi.service.ts` |
| Rotas de pagamento | `backend/src/routes/payments.routes.ts` |
| Webhooks | `backend/src/routes/webhooks.routes.ts` |
| Máquina de estados | `backend/src/jobs/billing-state-machine.job.ts` |
| Templates de e-mail | `backend/src/config/billing-templates.ts` |
| Jobs auxiliares | `backend/src/jobs/{overdue-charges,expiry-alert,commission-availability}.job.ts` |
| Motor de comissões | `backend/src/services/commission-engine.service.ts` |
| Admin (billing) | `backend/src/controllers/admin.controller.ts` + `routes/admin.routes.ts` |
| Parceiros | `backend/src/controllers/partners.controller.ts` + `tenant-partner.controller.ts` |
| Guard de status | `backend/src/middleware/tenant-status.middleware.ts` |
| Signup | `backend/src/controllers/signup.controller.ts` |
