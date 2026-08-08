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

### Nível 2 — self-service automático (Cloudflare for SaaS)

O produtor cadastra o próprio domínio no painel dele e a Cloudflare provisiona validação +
SSL automaticamente — **sem trabalho manual da equipe**. Decisão de arquitetura: usar uma
**ZONA DEDICADA** (ex.: `apptribohub.com.br`) só para os custom hostnames, mantendo a zona
principal (API, marketing, app) intocada.

**Código (pronto, gated por env):**
- `apps/api/src/cloudflare/cloudflare.service.ts` — cria/checa/remove custom hostname (API CF).
- `apps/api/src/dominio/` — `/painel/dominio` (GET/PUT/POST verificar/DELETE), self-service do
  produtor, restrito ao dono (EquipeGuard). Sem env configurado → responde 503 (recurso "Em breve").
- `apps/web/app/painel/dominio/page.tsx` + link no menu — o produtor cadastra o domínio, vê o
  CNAME a criar e o status (pendente/ativo), com botão Verificar.
- `infra/saas-proxy/` — Worker fallback origin (proxy do front para o Pages).
- Env: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_SAAS_TARGET`.

**Runbook de ativação (uma vez):**
1. Registrar um domínio dedicado (ex.: `apptribohub.com.br`) e adicioná-lo como zona na Cloudflare.
2. Nessa zona: **SSL/TLS → Custom Hostnames → habilitar Cloudflare for SaaS**.
3. Criar um registro **A `origin` → `192.0.2.0`** (dummy, proxied) e definir `origin.apptribohub.com.br`
   como **fallback origin** do SaaS.
4. Publicar o Worker: em `infra/saas-proxy/wrangler.toml` trocar `apptribohub.com.br` pelo domínio
   real, então `cd infra/saas-proxy && npx wrangler deploy` (rota `*/*` na zona dedicada).
5. Criar um **token de API** (Cloudflare → My Profile → API Tokens) com permissão
   *Zone → SSL and Certificates → Edit* (ou *Custom Hostnames*) na zona dedicada.
6. No Railway (serviço `tribo_hub`), setar as env: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`
   (id da zona dedicada) e `CLOUDFLARE_SAAS_TARGET=origin.apptribohub.com.br`. Deploy da API.
7. Testar com um domínio real: no painel do produtor, cadastrar `area.<dominioteste>.com`,
   criar o `CNAME → origin.apptribohub.com.br` no DNS do domínio de teste, clicar **Verificar**
   até ficar **Ativo**, e acessar.

**Custos:** 100 custom hostnames grátis, US$ 0,10/hostname/mês depois; Worker grátis até
100k req/dia, ~US$ 5/mês acima. O domínio dedicado (~R$40/ano). O mecanismo de tenant
(header `X-Tenant-Slug`) é o mesmo — muda só o provisionamento.
