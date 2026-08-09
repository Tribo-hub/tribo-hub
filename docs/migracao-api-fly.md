# Migração da API: Railway (US) → Fly.io (São Paulo)

**Motivo:** a API estava em US East e o banco (Supabase) em `sa-east-1` (São Paulo). Cada
request cruzava EUA↔Brasil várias vezes (~0,8s de piso por request, mesmo no `/health`).
Colocando a API em São Paulo (Fly.io `gru`), ela fica **junto do banco e perto dos usuários**
→ ganho ~10x. O banco NÃO é tocado (a API é sem estado).

Estratégia: subir no Fly **em paralelo**, testar/medir, e só então apontar `api.tribohub.com.br`.
O Railway continua no ar como **rollback** até a confirmação.

Artefatos já no repo: `Dockerfile`, `.dockerignore`, `fly.toml` (região `gru`, 1 máquina sempre ligada).

---

## Passo 1 — Conta Fly + CLI (você)
1. Criar conta em https://fly.io (pede cartão; cobrança por uso, ~poucos dólares/mês).
2. Instalar o flyctl:
   - Windows (PowerShell): `iwr https://fly.io/install.ps1 -useb | iex`
   - depois reabrir o terminal e `fly version` para conferir.
3. `fly auth login` (abre o navegador).

## Passo 2 — Criar o app (você, na raiz do projeto)
```bash
fly apps create tribohub-api   # se o nome existir, escolha outro e ajuste o fly.toml
```
(Não rode `fly launch` — ele reescreveria o fly.toml. Use `fly apps create`.)

## Passo 3 — Copiar as variáveis do Railway para o Fly (você — segredos ficam local)
```bash
# exporta as variáveis do Railway e importa como secrets no Fly, sem passar por terceiros
railway variables --kv --service tribo_hub > flyvars.env
# remova linhas que NÃO devem ir: PORT e quaisquer RAILWAY_*
#   (abra flyvars.env e apague PORT=... e linhas RAILWAY_...)
fly secrets import -a tribohub-api < flyvars.env
del flyvars.env    # apague o arquivo com segredos
```
Se `railway variables --kv` não existir na sua versão, use `railway variables` (tabela) ou o
dashboard do Railway e rode `fly secrets set CHAVE="valor"` para cada uma. As essenciais:
`DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET, APP_URL,
API_URL, APP_BASE_DOMAIN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou SERVICE_ROLE),
SUPABASE_STORAGE_BUCKET, RESEND_API_KEY, EMAIL_FROM, EFI_*, CLOUDFLARE_*`.

## Passo 4 — Deploy no Fly (eu faço, se o flyctl estiver logado; ou você)
```bash
fly deploy -a tribohub-api
```
Sobe a imagem Docker na região `gru`. Ao final, a API responde em `https://tribohub-api.fly.dev`.

## Passo 5 — Testar em paralelo (eu faço)
- `https://tribohub-api.fly.dev/api/health` → deve responder `{status:ok, db:up}` e **MUITO mais rápido**
  (esperado: dezenas de ms de processamento, contra ~0,8s do Railway).
- Login + `/me` funcionando.
- Comparar o tempo com o Railway para confirmar o ganho.

## Passo 6 — Apontar o domínio (você + eu)
1. No Fly: `fly certs add api.tribohub.com.br -a tribohub-api` (mostra o registro DNS a criar).
2. Na Cloudflare (DNS de `tribohub.com.br`): apontar `api` para o Fly conforme o `fly certs`
   (CNAME para `tribohub-api.fly.dev` **DNS only / nuvem cinza**, ou os IPs que o Fly indicar).
3. Aguardar o `fly certs show api.tribohub.com.br` ficar válido (SSL emitido).
4. Testar `https://api.tribohub.com.br/api/health` já batendo no Fly (medir o ganho no ar).

## Passo 7 — Ajustes finais (eu faço)
- `infra/saas-proxy/wrangler.toml`: `API_ORIGIN` passa a apontar para o Fly (domínio próprio de
  cliente reencaminha `api.*` para lá) e redeploy do worker.
- `deploy.sh` / `DEPLOY.md`: trocar `railway up` por `fly deploy` para a API.

## Rollback
Se algo der errado, reapontar o DNS de `api` de volta para o Railway (que segue no ar).
Só desligar/decomissionar o Railway depois de alguns dias estável no Fly.
