# Billing/Super Admin — Estudo "Aproveitar × Customizar" (TriboCRM → Tribo Hub)

Estudo do `MODULO_PAGAMENTO_BLUEPRINT.md` (TriboCRM) cruzado com o que a Tribo Hub **já tem hoje**, para decidir o que dá para **aproveitar**, o que precisa **customizar** e o que é **criar do zero** — sempre respeitando o **nosso modelo de negócio**.

Legenda: ✅ já temos · ♻️ aproveitar conceito/código · 🔧 customizar p/ nosso modelo · 🆕 criar

---

## 0. A diferença de modelo (o que muda tudo)

| | TriboCRM | Tribo Hub |
|---|---|---|
| **Régua de cobrança** | Plano fixo por tenant (mensal/anual) | **Base + por aluno ativo** (infoprodutor) / **por assentos** (corporativo) |
| **Quem assina** | Cliente faz **signup self-service** com trial 30d | Conta criada **pelo Super Admin** (sem self-service hoje) |
| **Modos** | Um só (CRM) | **Bimodal** (infoprodutor / corporativo) |
| **Apuração** | Valor do plano | **Calculada no fim do mês** pelo uso real |

> Conclusão: a **mecânica de controle/automação/cobrança** do TriboCRM serve muito bem; o que **não** se copia é a régua de preço (lá é plano fixo; aqui é uso). Vários conceitos entram com adaptação.

---

## 1. O que a Tribo Hub JÁ TEM (mapa atual)

- **`AssinaturaPlataforma`** por conta: `plano`, `tipoCobranca`, `valorBase`, `alunosIncluidos`, `valorPorExcedente`, `limiteUsuarios`, `status` (`ativa`/`suspensa`/…).
- **`FaturaPlataforma`** mensal (= o "Charge" deles): `competencia` (YYYY-MM), `alunosAtivos`/`assentosUsados`, `valorBase`/`valorExcedente`/`valorTotal`, `status`, `txid`, `pixCopiaECola`, `pagoEm`. Único por `conta+competência` (idempotente).
- **Cálculo por uso** (`billing.service.calcular`): infoprodutor conta alunos ativos (matrícula vigente, dedupe) × excedente; corporativo conta assentos (alunos ativos).
- **Fechamento mensal** (`fecharFatura`/`fecharTodas`) — idempotente, não recalcula fatura paga.
- **Gateway Efí (PIX)** (`efi.service`) + emissão de cobrança Pix por fatura (`cobrar`).
- **Webhook Efí JÁ implementado** (`/webhooks/efi` e `/webhooks/efi/pix`): confirma pagamento por `txid` de forma **idempotente** (`processarWebhookEfi`/`confirmarPagamentoPorTxid`) + endpoints GET de "ping" para registro.
- **Super Admin**: faturamento (listar com **MRR**, fechar, **cobrar Pix**, **marcar paga**), contas (CRUD, ativar/desativar).
- **Prévia da própria fatura** para o produtor (`painel/minha-fatura`).
- **Cron diário** (Railway): **expira matrículas** vencidas (saem da cobrança) e **fecha faturas no dia 1**.

> Ou seja: **controle (contas/assinatura)**, **apuração por uso**, **cobrança Pix**, **confirmação automática por webhook** e **cron** já existem. Falta principalmente a camada de **ciclo de vida/avisos/suspensão**, **autoatendimento**, **descontos/cupons**, **parceiros** e **relatórios mais ricos**.

---

## 2. Função a função

### 2.1 Catálogo de planos (`Plan`)
- TriboCRM: tabela `Plan` com preço e **limites** (maxUsers, etc.) editáveis no Super Admin.
- Nós: hoje o "plano" é texto livre na assinatura + valores digitados por conta. 🔧 **Customizar**: criar um **catálogo de planos** (Essencial/Profissional/Escala + Corporativo) com `valorBase`, `alunosIncluidos`/`assentos`, `valorPorExcedente` e flags de recurso — e a assinatura aponta para o plano. Facilita padronizar preços e mudar tudo num lugar.

### 2.2 Estado da assinatura no tenant
- ✅ Já temos `AssinaturaPlataforma.status`. 🔧 Customizar os estados para o ciclo: `ativa` / `inadimplente` / `suspensa` / `cancelada` (+ talvez `trial` se adotarmos autoatendimento).

### 2.3 Cobrança individual (`Charge`)
- ✅ Nossa `FaturaPlataforma` já é isso (mensal, por competência). ♻️ Aproveitar como está; só estender campos se precisar (ex.: `tipo` MANUAL, `desconto`).

### 2.4 Gateway Efí
- ✅ PIX pronto + webhook. 🆕 **Boleto** (opcional) e 🆕 **cartão recorrente** (opcional) — só se o negócio quiser. Recomendo **manter Pix** como principal (já cobre o fluxo) e avaliar boleto depois.

### 2.5 Signup / trial / checkout self-service
- TriboCRM: cliente se cadastra sozinho, trial 30d, escolhe plano/método.
- Nós: contas são criadas pelo Super Admin. 🆕 **Criar (decisão de negócio)**: se quisermos que o produtor se cadastre sozinho e pague, precisamos de signup + trial + checkout. **Hoje não é necessário** para operar (venda assistida). É o maior item — só fazer se for meta.

### 2.6 Webhook de confirmação
- ✅ **Já temos** (Efí Pix, idempotente). ♻️ Nada a fazer além de garantir HMAC/validação (ver §3).

### 2.7 Máquina de estados de billing (avisos + atraso + suspensão) — **o item mais valioso**
- TriboCRM: job diário idempotente manda e-mails (D-7/D-3/D-1), gera cobrança, marca atraso e **suspende**.
- Nós: o cron hoje só **fecha** a fatura; **não avisa, não cobra sozinho, não suspende**. 🆕🔧 **Criar adaptado ao nosso ciclo (pós-uso):**
  - Dia 1: fecha fatura **e já emite o Pix** + e-mail "fatura disponível".
  - +N dias sem pagar: e-mail "vence em X" → "em atraso" → **suspende** (`status=suspensa`).
  - Webhook de pagamento volta para `ativa` (já temos a confirmação; falta o "voltar a ativa" + limpar marcador).
  - Reaproveitar os **princípios**: marcador de idempotência (`lastBillingState`/`lastBillingStateAt` na conta), `updateMany` com guarda anti-corrida, e-mail antes do update.

### 2.8 Controle de acesso / suspensão
- TriboCRM: middleware bloqueia conta `SUSPENDED`/`CANCELLED` (super admin bypassa), com cache.
- Nós: temos `Conta.ativo` (manual) e `assinatura.status`, mas **não bloqueamos** por inadimplência automaticamente. 🆕 **Criar**: guard que, se `assinatura.status = suspensa`, bloqueia o painel do produtor (e/ou a área do aluno?) com aviso de pagamento — **decisão**: suspender derruba os **alunos** também ou só o **painel do produtor**? (sugiro começar bloqueando só o painel do produtor).

### 2.9 Limites por plano (enforcement)
- TriboCRM: bloqueia criar recurso ao bater o limite (maxUsers, etc.).
- Nós: o modelo é **por uso cobrado** (excedente vira valor na fatura), não bloqueio. 🔧 Customizar: provavelmente **não bloquear** (cobrar o excedente é o nosso jeito); no máximo **avisar** o produtor quando passar do incluído. Mantém o nosso modelo.

### 2.10 Cupons e descontos
- TriboCRM: `Coupon` (CRUD, % ou fixo, validade, 1º mês/recorrente) + desconto por tenant.
- Nós: 🆕 **Criar** (faz sentido p/ vendas): desconto por conta (campo na assinatura: `descontoTipo/valor/até/ciclos/motivo`) aplicado no fechamento da fatura. **Cupom self-service** só se houver signup (§2.5).

### 2.11 Upgrade/downgrade
- TriboCRM: upgrade prorateado, troca só no pagamento.
- Nós: como cobramos por uso, "mudar de plano" = mudar **base/faixa/valor por excedente** na assinatura. 🔧 Customizar: edição simples da assinatura pelo Super Admin (já dá), com a mudança valendo a partir da próxima competência.

### 2.12 Super Admin financeiro (relatórios)
- ✅ Temos **MRR** (soma faturas do mês). 🔧 Ampliar: **ARR, churn, ticket médio, inadimplência, MRR histórico (6m), alertas** (a calcular sobre `FaturaPlataforma`/contas — base de dados já existe).

### 2.13 Cobrança manual + notas por conta
- ✅ Temos `cobrar` (Pix por fatura) e `marcar paga`. 🆕 Estender: **cobrança avulsa** (fora do ciclo) com desconto/nota, e **notas internas** por conta (suporte/financeiro).

### 2.14 Parceiros / comissões (afiliados)
- TriboCRM: programa completo (código, tiers progressivos, comissão por cobrança paga, carência 30d, payout manual, anti-fraude).
- Nós: 🆕 **Criar (decisão de negócio)** — só se quisermos **vender via afiliados**. É um módulo grande e independente. Reaproveitável **quase inteiro** (a régua de comissão é sobre a fatura paga, que já temos). **Recomendo deixar por último** e só se for estratégia.

---

## 3. Princípios de design a reaproveitar (valem 100%)
1. **Idempotência onde o webhook toca** — já aplicamos (fatura já-paga retorna cedo). Manter na máquina de estados (marcador) e em comissões (`chargeId`/`faturaId` único).
2. **Fire-and-forget** no secundário (e-mail/comissão nunca quebra o pagamento).
3. **Best-effort no gateway** (a fonte da verdade é o nosso banco).
4. **Troca de plano só efetiva no pagamento** (quando houver upgrade pago).
5. **Carência** antes de liberar comissão (se fizermos parceiros).
6. **Anti-corrida** webhook×job (`updateMany` + guarda de status).
7. **HMAC no webhook da Efí** — ⚠️ hoje nosso webhook Pix é público sem validação de assinatura; vale **adicionar verificação (HMAC/mTLS/allowlist)** como melhoria de segurança.

---

## 4. Recomendação de fases (priorizada p/ o nosso modelo)

**Fase 1 — Ciclo de vida da fatura (maior valor, baixo atrito):**
- Emitir o Pix automaticamente ao fechar + **e-mails** (fatura disponível, vence em X, em atraso).
- **Suspensão automática** por inadimplência (`assinatura.status`) + **guard** bloqueando o painel do produtor suspenso.
- Endurecer o **webhook Efí** (HMAC).

**Fase 2 — Super Admin financeiro + descontos:**
- Relatórios (ARR, churn, ticket, inadimplência, MRR 6m, alertas).
- **Desconto por conta** + **cobrança avulsa** + **notas internas**.
- (Opcional) **Catálogo de planos** para padronizar preços.

**Fase 3 — Autoatendimento (se for meta):**
- Signup + trial + checkout próprio (Pix) + cupons self-service.

**Fase 4 — Parceiros/afiliados (se for estratégia):**
- Programa de comissões completo (reaproveita o blueprint quase 1:1).

---

## 5. Decisões de negócio que preciso de você (mudam o escopo)
1. **Suspensão automática:** quando a conta fica inadimplente, suspendemos **só o painel do produtor** ou **também a área dos alunos**? (sugiro só o painel no começo)
2. **Autoatendimento (Fase 3):** queremos que o produtor **se cadastre e pague sozinho** (trial + checkout), ou a venda continua **assistida** (Super Admin cria a conta)?
3. **Métodos de pagamento:** seguimos **só Pix** (recomendado) ou também **boleto/cartão recorrente**?
4. **Parceiros/afiliados (Fase 4):** entra no roadmap ou descartamos por enquanto?
5. **Trial:** se houver autoatendimento, **quantos dias** de teste?

---

*Estudo gerado a partir de `MODULO_PAGAMENTO_BLUEPRINT.md` + leitura do código atual (`billing.service`, `billing.controller`, `cron.ts`, `efi.service`, schema). Nada implementado — é só o estudo.*
