# Tribo Hub — Plano de Execução & Orquestração AIOX

> Autor: Aria (Architect) · Documento mestre de execução. Define o **faseamento**, a **arquitetura de execução** e como o **squad AIOX** roda cada fase de forma autônoma, com os **hand-offs** que cada etapa produz.
> Fontes: `tribohub_especificacao_tecnica_v4.md` (PRD de fato), `schema.prisma` (modelo de dados), `tribohub_mockup_v2.html` (UI aprovada).

---

## 1. Arquitetura de Execução

### 1.1 Monorepo (pnpm workspaces)
```
tribo-hub/
├─ apps/
│  ├─ web/        # Next.js 14 (App Router) + Tailwind — /app, /painel, /admin
│  └─ api/        # NestJS — REST, auth, webhooks, jobs
├─ packages/
│  ├─ db/         # Prisma (schema.prisma + migrations + client)
│  ├─ ui/         # design system extraído do mockup v2 (tokens "tribo", tema claro/escuro)
│  └─ config/     # eslint, tsconfig, env schema (zod) compartilhados
├─ docs/          # prd, architecture, stories, qa
└─ .aiox/         # handoffs/ + estado de orquestração
```

### 1.2 Ambientes
| Ambiente | Frontend | Backend | Banco |
|---|---|---|---|
| Dev (local) | `pnpm dev` (web) | `pnpm dev` (api) | Supabase (cloud, free) |
| Preview (PR) | Cloudflare Pages preview | Railway preview | Supabase (projeto de staging) |
| Produção | Cloudflare Pages / Vercel Pro | Railway/Render | Supabase (plano pago) |

### 1.3 Pipeline (GitHub Actions)
`lint → typecheck → prisma validate → test → build`. Deploy automático em merge na `main` (preview em PR). Branch por story: `feat/<fase>-<story>`.

### 1.4 Princípios arquiteturais não-negociáveis
1. **Isolamento por `conta_id` em toda query** (guard/interceptor central no NestJS; nunca confiar no caller).
2. **Conteúdo isolado no modo infoprodutor** (`proprietario_tipo = tenant`) vs catálogo global (`plataforma`).
3. **Webhooks idempotentes** (`webhook_events.hash` único) e validados por assinatura.
4. **Matrícula é a fonte única da contagem de cobrança** do infoprodutor.
5. **Env via schema (zod)** — nada de segredo hardcoded; `.env.example` sempre atualizado.

---

## 2. Faseamento (Epics)

Cada fase é um **epic** com Definition of Done (DoD) verificável. O squad só avança de fase quando o PO valida o DoD.

### Fase 0 — Fundação & Bootstrap
- Monorepo, git + GitHub remote, CI verde, env schema, design system base (tema claro/escuro do mockup v2).
- Supabase provisionado (banco + bucket de storage); **1ª migration** do `schema.prisma` aplicada; módulo Prisma no NestJS; health-check; web↔api integrados.
- **DoD:** `pnpm dev` sobe web+api; migration aplicada; CI verde; deploy de preview funcionando.

### Fase 1 — Multi-tenant, Auth & Contas (Super Admin)
- Middleware de tenant (resolução por host/subdomínio) + guard de `conta_id`.
- Auth JWT (login/refresh/logout, bcrypt 12, rate limit, bloqueio 5x), `accept-invite`, `forgot/reset`.
- CRUD de contas (`tipo_conta`, slug, subdomínio) + criação do admin do tenant + assinatura base. RBAC (super_admin/admin_tenant/aluno).
- Telas: login; `/admin` contas.
- **DoD:** super admin cria conta corporativa e infoprodutor; admin recebe convite e loga; teste e2e prova que cross-tenant é **negado**.

### Fase 2 — Motor de Conteúdo bimodal
- Trilha→Módulo→Aula CRUD + soft delete + reorder; `proprietario_tipo` (plataforma global × tenant isolado); upload Supabase Storage (signed URL) p/ vídeo/material/legenda; `tipo_video`; publicar/despublicar.
- Telas `/painel` editor de conteúdo (produtor cria o seu; super admin cria catálogo).
- **DoD:** produtor cria curso isolado; catálogo da plataforma aparece só a contas corporativas; isolamento de conteúdo testado.

### Fase 3 — Experiência do Aluno (/app)
- Home ("continue de onde parou"), trilha (bloqueio sequencial 80%), player, progresso (auto 80% + manual), próxima aula; certificado (100% → PDF no R2 + `/verificar/:codigo`).
- **DoD:** aluno assiste, progride, conclui e baixa certificado; verificação pública funciona.

### Fase 4 — Modo Corporativo completo
- Convite de colaboradores (limite de assentos), gestão de equipe, dashboard gestor (engajamento, ranking, inativos).
- **DoD:** gestor convida respeitando o limite; dashboard com métricas reais.

### Fase 5 — Modo Infoprodutor: Ofertas, Matrículas & Webhooks
- Ofertas (produto externo→trilha, prazo/vitalício); integração Hotmart (secret); webhook (compra→cria aluno+matrícula; reembolso/chargeback→inativa) com idempotência; lifecycle da matrícula + ações do produtor (inativar/prorrogar/reativar); **job diário de expiração**; dashboard produtor.
- **DoD:** compra de teste na Hotmart libera acesso; reembolso revoga na hora; job expira corretamente; contagem de alunos ativos confere.

### Fase 6 — Cobrança da Plataforma (sua receita)
- `assinaturas_plataforma` (assentos × alunos_ativos); medidor mensal de alunos ativos (dedupe 1x/conta); `faturas_plataforma`; integração **Efí** (Pix/boleto/cartão recorrente); painel `/admin` faturamento + MRR.
- **DoD:** fatura mensal apurada certa nos dois modelos; cobrança Efí emitida.

### Fase 7 — Hardening & Lançamento
- Segurança (Helmet/CORS/validação/logs), Sentry, performance, **domínios próprios** (Cloudflare for SaaS), notificações por e-mail, QA de regressão, deploy de produção.
- **DoD:** checklist de arquitetura/segurança aprovado; produção no ar; primeiro cliente onboardável.

---

## 3. Orquestração AIOX (autônoma, por fase)

### 3.1 Ciclo padrão de cada fase
```
@pm        → PRD/epic da fase            → docs/prd/phase-N.md
@architect → plano + contexto técnico    → docs/architecture/phase-N.md, plano por story
@po        → fatiar epic em stories      → docs/stories/N.x-*.md (valida com checklist)
   └─ loop por story:
        @sm  → rascunha a próxima story (create-next-story)
        @dev → implementa a story
        @qa  → verifica/review
        @devops → CI/deploy/merge
@po        → valida DoD da fase → libera próxima fase
```

### 3.2 Como roda sozinho
- O **@aiox-master** é o orquestrador: lê `.aiox/handoffs/` (artefato YAML com `from_agent`, `last_command`, `consumed`) e a cadeia em `.aiox-core/data/workflow-chains.yaml` para decidir o próximo agente/comando.
- Cada agente, ao concluir, **grava um handoff** marcando o anterior como `consumed: true` e apontando o próximo passo. O master encadeia até fechar as stories e o DoD da fase.
- Estado e progresso ficam em `docs/stories/` (status das stories) + `.aiox/handoffs/` (cadeia atual).

### 3.3 Gates humanos (a autonomia PARA e te chama)
1. **Credenciais externas**: GitHub, Supabase, Cloudflare, Resend, Hotmart (teste), Efí — só você cria. (Fase 0 precisa de GitHub + Supabase; Fase 2 do bucket de Storage no Supabase; Fase 5 de Hotmart; Fase 6 de Efí.)
2. **Aprovação visual/UX** de telas-chave.
3. **Go-live** de produção (Fase 7).

Fora desses gates, o squad avança story a story sem intervenção.

---

## 4. Matriz de Hand-offs / Documentos por Fase

| Fase | PM | Architect | PO/SM | Dev | QA | DevOps |
|---|---|---|---|---|---|---|
| 0 | escopo bootstrap | este plano + setup repo | stories de setup | scaffold web/api/db | smoke test | CI + preview |
| 1 | epic auth/tenant | plano auth + RBAC | stories auth/contas | endpoints+telas | e2e isolamento | deploy |
| 2 | epic conteúdo | plano upload/isolamento | stories CRUD | conteúdo + Storage | teste isolamento | deploy |
| 3 | epic aluno | plano player/progresso | stories /app | telas + progresso + cert | e2e jornada | deploy |
| 4 | epic corporativo | plano assentos/dashboard | stories | convites + dashboard | testes | deploy |
| 5 | epic infoprodutor | plano webhook/matrícula | stories | ofertas+webhook+job | teste compra/reembolso | deploy |
| 6 | epic cobrança | plano metering/Efí | stories | faturamento + Efí | teste apuração | deploy |
| 7 | critérios de lançamento | checklist segurança/perf | stories hardening | ajustes | regressão | produção |

Artefatos por story: `prd/epic`, `architecture/plan`, `story` (+ contexto), implementação, `qa report`, `deploy notes`.

---

## 5. Como iniciar a autonomia
1. **Gate inicial (você):** criar GitHub repo + Supabase (DATABASE_URL/DIRECT_URL). Demais credenciais entram nas fases que as exigem.
2. Acionar **@aiox-master** para orquestrar a partir da **Fase 0**, consumindo o handoff deixado pelo Architect.
3. O master roda o ciclo da §3.1 fase a fase, parando apenas nos gates da §3.3.
