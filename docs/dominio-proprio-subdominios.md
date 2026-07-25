# Área de membros por cliente — subdomínio e domínio próprio

Como cada cliente tem seu próprio endereço (ex.: `vendas.tribohub.com.br`) em vez de
todos usarem `app.tribohub.com.br`. Fase 1 (subdomínio) está implementada; Fase 2
(domínio próprio do cliente) está desenhada ao final.

## Como funciona (arquitetura)

O front é uma **SPA estática única** (Next `output: 'export'`) servida pelo Cloudflare
Pages. O mesmo build roda em qualquer subdomínio — o que muda é o que o JavaScript lê de
`window.location.hostname`:

1. `apps/web/lib/tenant.ts` (`tenantDoHost`) extrai o slug do subdomínio
   (`vendas.tribohub.com.br` → `vendas`).
2. `apps/web/lib/api.ts` envia esse slug em **todo request** no header `X-Tenant-Slug`.
3. Na API, `apps/api/src/common/middleware/tenant.middleware.ts` lê o header (ou o Host)
   e popula `req.tenantSlug`.
4. `login`, `signup`, `forgot-password` e o endpoint público de marca já usam `tenantSlug`
   para restringir tudo à conta certa.
5. `apps/web/lib/useMarcaPublica.ts` chama `GET /api/publico/marca` **antes do login**
   para a tela já aparecer com nome/logo/cor do cliente.

Invariante importante: **`slug === subdominio`**. O rótulo do subdomínio É o código público
da conta. Ao editar o subdomínio no super-admin, os dois são atualizados juntos
(`apps/api/src/contas/contas.service.ts` → `atualizar`).

## O que foi implementado (código)

| Camada | Arquivo | O quê |
|---|---|---|
| API | `common/middleware/tenant.middleware.ts` | Lê header `X-Tenant-Slug` (prioridade) + Host |
| API | `main.ts` | CORS libera qualquer `*.tribohub.com.br` |
| API | `publico/publico.controller.ts` | `GET /api/publico/marca` (sem auth) |
| API | `contas/contas.service.ts` + DTO | Editar `subdominio` (sync com `slug`, reservados, unicidade) |
| Web | `lib/tenant.ts` | `tenantDoHost()` — slug pelo hostname |
| Web | `lib/api.ts` | injeta `X-Tenant-Slug` |
| Web | `lib/useMarcaPublica.ts` + `components/MarcaHeader.tsx` | marca do cliente nas telas públicas |
| Web | `app/login`, `app/cadastro`, `app/esqueci-senha` | usam o tenant do host + marca |
| Web | `app/admin/contas/detalhe` | card "Endereço da área de membros" |

## Operação: dar um subdomínio a um cliente (o método em uso)

Abordagem adotada: **um custom domain por cliente no projeto Pages `tribohub`**. Simples,
seguro e sem código de infra. Bom para poucos/dezenas de clientes.

1. **Super-admin** → Contas → abrir a conta → card **Endereço da área de membros** →
   digitar o subdomínio (ex.: `vendas`) → Salvar. (Isso grava `slug` = `subdominio`.)
2. **Cloudflare** → Workers & Pages → projeto **`tribohub`** (o app, NÃO o `tribohub-site`)
   → aba **Custom domains** → **Set up a domain** → `vendas.tribohub.com.br` → Activate.
   A Cloudflare cria o CNAME e o certificado SSL automaticamente (fica **Active** em ~1-3 min).
3. Entregar ao cliente: `https://vendas.tribohub.com.br`.

Nada de código, nada de wildcard. O app estático do Pages passa a responder também naquele
host; o front lê o subdomínio (`lib/tenant.ts`) e manda `X-Tenant-Slug`. `app.tribohub.com.br`
segue funcionando como porta geral.

Primeiro cliente em produção: **`mentoria.tribohub.com.br`** (conta Tribo de Vendas), 24/07/2026.

## Alternativa para escala (wildcard + Worker) — NÃO usada ainda

Quando o nº de clientes crescer e você quiser onboarding **sem tocar na Cloudflare** a cada
cliente, troque o "custom domain por cliente" por um wildcard + Worker (código já pronto em
`infra/tenant-proxy/`):

1. **DNS wildcard**: `CNAME  *  → tribohub.pages.dev` (Proxy ativado). `app` e `api` seguem
   como registros mais específicos.
2. **API_ORIGIN**: no Railway → `tribo_hub` → Settings → Networking, copiar o `*.up.railway.app`
   e colar em `infra/tenant-proxy/wrangler.toml`.
3. **Publicar**: `cd infra/tenant-proxy && npx wrangler deploy` (rota `*.tribohub.com.br/*`).
   O worker serve o app para qualquer subdomínio e reencaminha `api.*` para o Railway.

Cuidado: a rota `*.tribohub.com.br/*` também casa `www.` e `api.` — o worker trata `api.*`,
mas confira que `www.` e o site de marketing não sejam capturados indevidamente antes de adotar.

---

## Fase 2 — domínio próprio do cliente (`area.cliente.com`) — desenho

Ainda não implementado. O `dominioProprio` já existe no schema e o middleware já resolve
tenant por ele. Falta:

1. **SSL para domínios de terceiros** → **Cloudflare for SaaS (Custom Hostnames)**. O
   cliente aponta `CNAME area.cliente.com → ssl.tribohub.com.br` (fallback origin) e a
   Cloudflare emite o certificado automaticamente.
2. **Front**: ao detectar hostname fora de `*.tribohub.com.br`, chamar
   `GET /api/publico/marca?host=area.cliente.com` para descobrir o slug e então enviar
   `X-Tenant-Slug` normalmente (o endpoint já aceita `?host=`).
3. **UI do produtor** (`admin_tenant`): tela para cadastrar o domínio, ver instruções de
   DNS e status de verificação (TXT).
4. **API**: endpoint para salvar `dominioProprio` + verificação por registro DNS.

O mecanismo de tenant (header `X-Tenant-Slug`) é o mesmo — só muda como o front descobre
o slug quando o hostname não é um subdomínio da plataforma.
