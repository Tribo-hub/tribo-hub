# Área de membros por cliente — subdomínio e domínio próprio

Como cada cliente tem seu próprio endereço (ex.: `vendas.tribohub.com.br` ou o domínio
próprio `area.cliente.com`) em vez de todos usarem `app.tribohub.com.br`. Fase 1
(subdomínio) e Fase 2 nível 1 (domínio próprio via custom domain no Pages) estão
implementadas; o self-service automático (Fase 2 nível 2) está desenhado ao final.

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

## Fase 2 — domínio próprio do cliente (`area.cliente.com`)

Endereço no domínio do PRÓPRIO cliente, ex.: `area.tribodevendas.com.br`.

### Nível 1 — MVP (implementado)

Usa o mesmo mecanismo da Fase 1: **custom domain no Pages** (funciona para subdomínio de
domínio externo — o cliente cria um CNAME e a Cloudflare emite o SSL). Sem Cloudflare for
SaaS, sem token de API.

Código (já no ar):
- `contas.service.ts` + DTO: super-admin grava/limpa `dominioProprio` (unicidade; bloqueia
  domínios `*.tribohub.com.br`, que vão no campo de subdomínio).
- `main.ts`: CORS libera dinamicamente origens de `dominioProprio` cadastrados (lookup + cache 60s).
- `lib/tenant.ts`: `hostCustom()` detecta domínio próprio; o slug é resolvido via
  `GET /publico/marca?host=...` e memorizado (`salvarSlugCustom`) para os próximos requests
  mandarem `X-Tenant-Slug`.
- `useMarcaPublica`: no domínio próprio busca a marca por `?host=` (nome/cor/logo antes do login).
- Super-admin → detalhe da conta: card **Domínio próprio** com as instruções de CNAME.

Operação (por cliente):
1. Super-admin → Contas → conta → card **Domínio próprio** → salvar `area.cliente.com`.
2. Cloudflare → projeto Pages **`tribohub`** → Custom domains → adicionar `area.cliente.com`.
3. Cliente cria no DNS dele: `CNAME area.cliente.com → tribohub.pages.dev`.
4. Aguardar status **Active** (SSL automático) e testar.

> Domínio RAIZ (`cliente.com` sem subdomínio) não funciona por este caminho — o Pages exige
> que o apex esteja na sua conta Cloudflare. Para apex, use o Nível 2.

### Nível 2 — self-service automático (não implementado)

Para o produtor cadastrar o próprio domínio no painel dele **sem você tocar na Cloudflare**
(e suportar domínio raiz), via **Cloudflare for SaaS (Custom Hostnames)**:

1. Habilitar Cloudflare for SaaS na zona + definir um **fallback origin** que sirva o app.
2. **Token de API** da Cloudflare (env) + integração com a API de custom hostnames
   (criar/checar/remover) no backend.
3. Verificação de propriedade + SSL por registro DNS (status pendente/ativo).
4. UI no painel do produtor (`admin_tenant`) para cadastrar o domínio e ver o status.

Preço: 100 custom hostnames grátis, US$ 0,10/hostname/mês depois (ver `MEMORY`/pesquisa).
O mecanismo de tenant (header `X-Tenant-Slug`) permanece o mesmo — muda só o provisionamento.
