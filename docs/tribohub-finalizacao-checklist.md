# Tribo Hub — Checklist de Finalização (pós-análise de gaps)

> Autor: Aria (Architect). Plano aprovado pelo Lucas em 21/06/2026. Execução em ondas, por impacto.
> Legenda: ✅ feito · 🟡 em andamento · ⬜ pendente · 🔒 gate humano (credencial/infra).

## Onda 1 — Receita & continuidade operacional (P0) — EM EXECUÇÃO

### S1 · Agendadores (crons) — mecanismo: **Railway Cron (serviço à parte)**
- ✅ Entrypoint `apps/api/src/cron.ts` (`node dist/cron.js daily|expirar|fechar`): expira matrículas todo dia; fecha faturas no dia 1.
- ✅ `railway.cron.json` (startCommand cron + `cronSchedule: "0 9 * * *"` = 06:00 BRT + restart NEVER).
- ✅ Testado localmente (sobe, resolve serviços, expira, exit 0).
- 🔒 **Você no Railway:** criar serviço "cron" no mesmo projeto, apontar Config Path = `railway.cron.json`, copiar as variáveis de ambiente do serviço principal, e fazer deploy (`railway up --service <cron>`). Setar `CRON_SECRET` (opcional — o cron chama os métodos direto, não precisa do segredo).
- ⬜ Validar: matrícula vencida vira `expirada` em 24h; fatura do mês fecha no dia 1.
- ❓ DECISÃO PENDENTE: no dia 1, o fechamento usa `competenciaAtual()` (mês corrente, igual ao botão manual). Se quiser faturar o mês que **encerrou**, mudar para mês anterior — confirmar política.

### S2 · Efí em produção: cert .p12 + confirmação automática
- ✅ `EfiService` aceita cert via `EFI_CERTIFICATE_BASE64` (produção) além do path local (dev).
- ✅ Webhook `POST /api/webhooks/efi/pix` → `BillingService.processarWebhookEfi` → marca fatura `paga` por `txid`.
- 🔒 **Você no Railway:** setar `EFI_CERTIFICATE_BASE64` (base64 do .p12) no serviço principal **e** no cron.
- 🔒 **Você na Efí:** registrar a URL do webhook Pix = `https://tribohub-production.up.railway.app/api/webhooks/efi` (a Efí adiciona `/pix`). Requer mTLS configurado na Efí.
- ⬜ Validar: cobrança real em prod; pagamento de teste confirma a fatura sem ação manual.

## Onda 2 — Fechar o loop dos dois modos (P0) — EM EXECUÇÃO
- ✅ S3 · UI Super Admin do catálogo de plataforma — FEITO (22/06/2026, só frontend: backend já escopava por papel). Telas `/admin/conteudo` + `/admin/conteudo/editar` reusando `/painel/trilhas...`; "Catálogo" 🎬 na sidebar admin. Deployado.
- ✅ S4 · Recuperação de senha — FEITO (22/06/2026). Model `PasswordResetToken` (db push); `POST /auth/forgot-password` (sempre 200, não revela existência, throttle 5/min) + `POST /auth/reset-password` (token 1h, marca usado); `EmailService.recuperacaoSenha`; telas `/esqueci-senha` e `/redefinir-senha` + link no login. 16 testes verdes. Deployado + rota live (200).
- ✅ S5 · E-mail de onboarding do admin — FEITO (22/06/2026). `ContasService.criar` agora gera `InviteToken` (7 dias) e envia `EmailService.convite` ao admin (define a própria senha); senha temporária mantida como fallback na tela. Resposta inclui `conviteEnviado`. Deployado.

## Onda 3 — Infoprodutor completo & aquisição (P1) — EM EXECUÇÃO
- ✅ S6 · Auto-cadastro do aluno — FEITO (23/06/2026). Flag `Conta.permiteAutoCadastro` (db push); `POST /auth/signup` (exige tenant infoprodutor com flag on, cria aluno + auto-login, throttle 5/min); tela `/cadastro` + link no login; toggle no detalhe da conta (Super Admin). Deployado, rota viva.
- ✅ S7 · Webhooks Eduzz e Kiwify — FEITO (23/06/2026, ⚠️ A VALIDAR com payload real). `webhook.service` refatorado num núcleo `aplicar()` + parsers por plataforma (hotmart/kiwify/eduzz → `EventoNorm`); endpoints `POST /webhooks/kiwify/:contaId` e `/webhooks/eduzz/:contaId` (segredo via `?token=`); validação por `Integracao.webhookSecret`. UI de ofertas generalizada p/ as 3 plataformas (segredo + URL do webhook cada). Parsers Kiwify/Eduzz baseados em docs públicas — comentados como "VALIDAR"; confirmar campos/status quando conectar conta real. 16 testes verdes. Deployado, rotas vivas.
- ✅ S8 · Dashboards faltantes — FEITO (23/06/2026). `GET /painel/dashboard/cursos` (conclusão por curso) + `GET /painel/dashboard/vendas` (receita do mês + últimas vendas via Transacao, já populada pelo webhook Hotmart) → exibidos no dashboard do produtor. `GET /admin/contas/:id/metricas` → cards no detalhe da conta. Deployado.

## Onda 4 — White-label & polish (P1/P2) — CONCLUÍDA (23/06/2026)
- ✅ S9 · White-label self-service: `PATCH /painel/marca` (CorporativoService, admin_tenant) atualiza cor+logo da própria conta; `/me` assina `logoUrl` quando é caminho do Storage; tela `/painel/marca` (upload de logo via signed-url `uploadArquivo` + color picker + preview) + item "Marca" 🎨 na sidebar (info+corp). Logo no certificado PDF: `aluno.service.carregarLogo()` baixa os bytes (Storage assinado ou URL) e `gerarPdf` embute com `doc.image()` (guard try/catch).
- ✅ S10 · Refinos: (a) toggle de tema 🌙/☀️ no header do aluno (`/app`); (b) reordenar módulos/aulas com ↑↓ nos editores (painel + admin) — DTOs `UpdateModuloDto`/`UpdateAulaDto` parciais p/ PATCH `{ordem}`, swap de ordem com vizinho; (c) legenda SRT→VTT como `<track>` no player (conversão client-side + blob, fallback no botão de download). Builds 16 testes verdes, deployado.

## Onda 5 — Hardening & Lançamento (Fase 7 — P2) — CÓDIGO CONCLUÍDO (23/06/2026)
- ✅ S11 · CI/CD — `.github/workflows/ci.yml` atualizado: Node 22, install → prisma generate → **prisma validate** → build packages → test (API) → build apps (com NEXT_PUBLIC_API_URL). 🔒 Para ativar: o repo precisa estar no GitHub e o arquivo enviado (push). Deploy segue manual via CLI.
- ✅ S12 · Observabilidade + isolamento — filtro global `AllExceptionsFilter` (loga 5xx com contexto path/método/usuário/conta) + helper `observability.ts` (Sentry-ready via require dinâmico; ativa se `SENTRY_DSN` setado e `@sentry/node` instalado). env ganhou `SENTRY_DSN`. Testes de isolamento: conteúdo (já existia) + NOVO `aluno.service.spec` (infoprodutor só vê trilhas com matrícula da própria conta; conta inativa barrada). 18 testes verdes. 🔒 Para Sentry real: `pnpm --filter @tribohub/api add @sentry/node` + setar SENTRY_DSN.
- 🟡 S13 · Domínios próprios — CÓDIGO FEITO: `TenantMiddleware` agora resolve **domínio próprio** (busca conta por `dominioProprio` com cache 60s) além do subdomínio. 🔒 INFRA (gate do usuário): Cloudflare for SaaS (custom hostnames), DNS dos subdomínios/domínios, e o front servido por host. Sem isso, segue tudo no domínio único atual + tenant via slug no login.
