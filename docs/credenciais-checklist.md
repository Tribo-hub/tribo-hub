# Tribo Hub — Checklist de Credenciais

Guia para criar todas as contas de uma vez e preencher o `.env`.
Marque conforme for criando. Valores vão **no arquivo `.env`** (nunca no `.env.example`).

> ✅ Os segredos da aplicação (JWT, cookie, cron) **já estão gerados** no `.env`. Você só precisa dos externos abaixo.

| ✔ | Serviço | O que criar | Onde pegar | Variáveis no `.env` | Fase | Custo |
|---|---|---|---|---|---|---|
| ☐ | **GitHub** | Repositório privado `tribo-hub` | github.com/new | — (usado pelo git remote) | 0 | Grátis |
| ☐ | **Supabase** | Projeto (Postgres + Storage) | supabase.com → Project Settings | `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 0 / 2 | Grátis |
| ☐ | **Cloudflare** | Conta + adicionar domínio | dash.cloudflare.com | (DNS do domínio + deploy do front) | 0–2 | Grátis |
| ☐ | **registro.br** | Domínio `tribohub.com.br` | registro.br | — | 0 | ~R$40/ano |
| ☐ | **Resend** | API Key + verificar domínio | resend.com → API Keys | `RESEND_API_KEY` | 1 | Grátis (3k/mês) |
| ☐ | **Hotmart** | Conta de teste + app/webhook | developers.hotmart.com | `HOTMART_WEBHOOK_SECRET`, `HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET` | 5 | Grátis |
| ☐ | **Efí** (ex-Gerencianet) | Conta + Aplicação (Client ID/Secret) + certificado Pix | sejaefi.com.br → API → Aplicações | `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERTIFICATE_PATH`, `EFI_PIX_KEY` | 6 | Por transação |
| ☐ | **Anthropic** *(opcional)* | API Key | console.anthropic.com | `ANTHROPIC_API_KEY` | opc. | Por uso |
| ☐ | **Sentry** *(opcional)* | Projeto | sentry.io | `SENTRY_DSN` | 7 | Free tier |

## Ordem recomendada para fazer agora
**Essenciais para começar (Fase 0–2):** GitHub → registro.br (domínio) → Cloudflare (adicionar domínio) → Supabase → Resend.
**Deixar para quando a fase chegar:** Hotmart (Fase 5), Efí (Fase 6), Sentry (Fase 7). Os slots já estão no `.env` — é só colar depois.

## Dicas importantes
- **Supabase (banco):** copie as DUAS strings em Database > Connection string. `DATABASE_URL` = "Connection pooling" (porta 6543); `DIRECT_URL` = "Direct connection" (porta 5432 — o Prisma usa a direct para migrations).
- **Supabase (storage):** crie o bucket `tribohub` em Storage; a `SUPABASE_SERVICE_ROLE_KEY` é usada **somente no backend** (nunca expor no frontend).
- **Resend:** o e-mail `no-reply@tribohub.com.br` só funciona após verificar o domínio (adicionar registros DNS no Cloudflare).
- **Efí:** a cobrança Pix exige o **certificado** (`.p12`/`.pem`) baixado no painel; guarde em `certs/` (já está no `.gitignore`). Comece em **sandbox/homologação**.
- **Hotmart/Efí:** comece sempre em **sandbox/teste** antes de produção.
- Nunca cole segredo em chat, em commit ou no `.env.example`. Só no `.env`.
