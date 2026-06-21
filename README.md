# Tribo Hub

Plataforma SaaS multi-tenant **bimodal**:
- 🔵 **Corporativo (B2B):** empresas formam colaboradores com o catálogo da plataforma.
- 🟣 **Infoprodutor (B2B2C):** área de membros; venda na Hotmart/Eduzz/Kiwify, acesso liberado por **webhook**.

## Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind — `apps/web`
- **Backend:** NestJS — `apps/api`
- **Banco + Storage:** Supabase (PostgreSQL) via Prisma — `packages/db`
- **Config/env:** zod — `packages/config`
- **Monorepo:** pnpm workspaces

## Como rodar (dev)
```bash
pnpm install
pnpm --filter @tribohub/db generate     # gera o Prisma Client
pnpm --filter @tribohub/db push         # sincroniza o schema com o Supabase
pnpm --filter @tribohub/db seed         # cria o super admin
pnpm dev                                # web (3000) + api (3333)
```
> Variáveis em `.env` (veja `.env.example`). Nunca versione o `.env`.

### Usuários de teste (dev)
| Papel | E-mail | Senha | Conta (tenant) |
|---|---|---|---|
| Super Admin | superadmin@tribohub.com.br | TriboAdmin@2026 | — |
| Produtor (infoprodutor) | joao@academiadotrafego.com.br | (temp na criação) | academia-do-trafego |
| Aluno | aluno@academiadotrafego.com.br | Aluno@2026 | academia-do-trafego |

> Em dev (localhost, sem subdomínio), o login de gestor/aluno aceita o campo **tenant** (slug da conta).

## Principais rotas da API (`/api`)
- **Auth:** `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/accept-invite`
- **Super Admin:** `GET/POST /admin/contas`, `PATCH /admin/contas/:id(/status)`
- **Conteúdo (produtor/admin):** `GET/POST /painel/trilhas`, `.../modulos`, `.../aulas`, `POST /painel/upload/signed-url`
- **Infoprodutor:** `GET/POST /painel/ofertas`, `PUT /painel/integracoes`, `GET /painel/matriculas` (+ inativar/reativar/prorrogar/cortesia), `GET /painel/alunos-ativos`
- **Corporativo:** `GET/POST /painel/colaboradores`, `GET /painel/dashboard(/ranking|/inativos)`
- **Aluno:** `GET /app/trilhas(/:id)`, `POST /app/progresso`, `GET /me/certificados(/:id/download)`
- **Webhook (público):** `POST /webhooks/hotmart/:contaId` (valida hottok, idempotente)
- **Público:** `GET /verificar/:codigo` (certificado)
- **Cron:** `POST /internal/matriculas/expirar` (header `x-cron-secret`)

## Scripts úteis
- `pnpm db:push` / `pnpm db:studio` — schema / Prisma Studio
- `pnpm --filter @tribohub/api test` — testes (Jest)
- `pnpm build` — build de tudo

## Status do roadmap
- ✅ F0 Fundação · ✅ F1 Auth/Contas · ✅ F2 Conteúdo · ✅ F3 Aluno · ✅ F4 Corporativo · ✅ F5 Infoprodutor (ofertas/matrículas/webhook) · ✅ Certificado PDF · ✅ Testes + CI
- ⏳ Pendente (depende de credenciais): e-mails (Resend, após domínio), cobrança recorrente (Efí — Fase 6), deploy de produção (Fase 7)

Documentação detalhada: `tribohub_especificacao_tecnica_v4.md`, `docs/tribohub-execution-plan.md`, `docs/credenciais-checklist.md`.
