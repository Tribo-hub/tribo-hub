# Story: Webhook Efí → liberação de acesso a infoproduto

Status: Ready for Review

## Story

**Como** infoprodutor da Tribo de Vendas,
**quero** que um pagamento confirmado no meu checkout Efí (via meu middleware) libere automaticamente o acesso do comprador ao produto no TriboHub e dispare o e-mail de acesso,
**para** não precisar matricular ninguém na mão.

## Contexto

O TriboHub já tem uma esteira de webhooks de infoproduto (Hotmart/Kiwify/Eduzz) em
`apps/api/src/infoprodutor/webhook.service.ts` que: cria/acha o aluno, cria a transação,
matricula (`upsertMatricula`), envia e-mail de acesso (link mágico) e trata reembolso/chargeback,
com idempotência por hash `plataforma:conta:transacao:tipo`.

Esta story **adiciona o Efí como mais uma plataforma nessa esteira** — sem alterar Hotmart/Kiwify/Eduzz
nem o Efí de cobrança da assinatura SaaS (`apps/api/src/billing`).

## Decisões travadas (Fase 0)

| Item | Valor |
|---|---|
| Duração do acesso | 365 dias (prazo) |
| Conta (tenant) | Tribo de Vendas (`tribo-de-vendas`), tipo `infoprodutor` |
| Código do produto (`codigoProdutoExterno`) | `desafio-7-dias` |
| Segurança | HMAC-SHA256 dos campos canônicos, com o `webhookSecret` da integração |

## Contrato do webhook

- **Rota:** `POST /api/webhooks/efi-produto/:contaId`
  (caminho distinto de `/api/webhooks/efi` e `/api/webhooks/efi/pix`, que são do billing — evita colisão)
- **Header de segurança:** `x-efi-assinatura: <hmac_sha256_hex>`
- **Payload (do middleware):**
  ```json
  {
    "evento": "approved",              // ou "refunded" / "chargeback"
    "email": "comprador@email.com",
    "nome": "Nome do Comprador",
    "produtoId": "desafio-7-dias",
    "transacao": "<txid/charge id do Efí>",
    "valor": 6700                       // em CENTAVOS
  }
  ```
- **Assinatura esperada:** `HMAC_SHA256(secret, "evento.email.produtoId.transacao.valor")` em hex,
  onde os valores são exatamente as strings enviadas, na ordem acima, unidas por `.`.
  Ex.: base = `approved.comprador@email.com.desafio-7-dias.abc123.6700`.

## Regras de normalização (correções vs. payload cru)

1. `valor` chega em **centavos** → gravado em `Transacao.valorBruto` em **reais** (÷100), igual à Kiwify.
2. `evento` é **case-insensitive** → normalizado para MAIÚSCULO antes de casar com
   `EVENTOS_LIBERA`/`EVENTOS_REVOGA` (approved→libera; refunded/chargeback→revoga; resto→ignora).
3. Mesmo `transacao` no approved e no refund é **correto** — o `tipo` entra no hash de idempotência,
   e a revogação encontra a transação original pelo `codigoTransacaoExterno`.

## Acceptance Criteria

1. `POST /api/webhooks/efi-produto/:contaId` com assinatura válida e `evento=approved` cria/acha o aluno,
   matricula na trilha da Oferta (`codigoProdutoExterno=desafio-7-dias`, `plataformaExterna=efi`) com
   expiração em 365 dias e envia o e-mail de acesso.
2. `evento=refunded`/`chargeback` (mesmo `transacao`) revoga a matrícula.
3. Assinatura ausente/inválida → 401 (comparação timing-safe).
4. Evento repetido (mesmo `transacao`+`tipo`) → `{ duplicate: true }`, sem efeito colateral.
5. `valorBruto` gravado em reais (6700 → 67.00).
6. Hotmart/Kiwify/Eduzz e o webhook Efí de billing continuam intactos.

## Tasks / Subtasks

- [x] Adicionar `efi` ao enum `PlataformaExterna` (schema.prisma)
- [x] Rota `POST /webhooks/efi-produto/:contaId` no `webhook.controller.ts`
- [x] `efi()` + `parseEfi()` no `webhook.service.ts` (÷100, uppercase)
- [x] Validação HMAC timing-safe (`validarEfi` + `assinaturaEfi`), refatorando `validar` para reusar `buscarIntegracao`
- [x] Testes unitários (libera, revoga, assinatura inválida, duplicado)

## Fora de escopo (Fase 2/3 — config e ops, não-código)

- `prisma generate` + `prisma db push` para registrar o valor `efi` no Postgres
- Criar a Trilha "Desafio 7 Dias" e a Oferta (`codigoProdutoExterno=desafio-7-dias`, `plataformaExterna=efi`, `tipoAcesso=prazo`, `duracaoAcessoDias=365`)
- Cadastrar o `webhookSecret` da integração `efi` da conta Tribo de Vendas
- Adicionar `efi` ao dropdown de integrações no painel (apps/web), se desejado
- Middleware do lado do Efí que assina e dispara o POST

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (Dex / AIOX dev)

### File List
- packages/db/prisma/schema.prisma (mod)
- apps/api/src/infoprodutor/webhook.controller.ts (mod)
- apps/api/src/infoprodutor/webhook.service.ts (mod)
- apps/api/src/infoprodutor/webhook.service.spec.ts (mod)
- apps/web/app/painel/ofertas/page.tsx (mod) — Fase 2: card de integração Efí + seletor de plataforma na oferta (corrige default 'hotmart' silencioso)

### Completion Notes
- Rota isolada `efi-produto` para não colidir com o billing (`/webhooks/efi`, `/webhooks/efi/pix`).
- HMAC de campos canônicos (não do raw body) para robustez de serialização e facilidade no middleware.
- Nenhuma mudança em main.ts/env.ts: segredo é por conta (tabela Integracao), reaproveitando o modelo existente.
