# Tribo Hub

Plataforma SaaS multi-tenant **bimodal**: educação corporativa (B2B) + área de membros para infoprodutores (B2B2C).

## Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind — `apps/web`
- **Backend:** NestJS — `apps/api`
- **Banco + Storage:** Supabase (PostgreSQL) via Prisma — `packages/db`
- **Config/env:** zod — `packages/config`
- **Monorepo:** pnpm workspaces

## Como rodar (dev)
```bash
pnpm install
pnpm --filter @tribohub/db generate   # gera o Prisma Client
pnpm dev                              # sobe web (3000) + api (3333)
```

> Variáveis de ambiente em `.env` (veja `.env.example`). Nunca versione o `.env`.

## Scripts úteis
- `pnpm db:push` — sincroniza o schema com o Supabase
- `pnpm db:studio` — abre o Prisma Studio
- `pnpm build` — build de todos os pacotes/apps

## Documentação
- `tribohub_especificacao_tecnica_v4.md` — especificação (PRD)
- `docs/tribohub-execution-plan.md` — faseamento e orquestração
- `docs/credenciais-checklist.md` — contas e credenciais
