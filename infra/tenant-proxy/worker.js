// Worker de proxy de subdomínios do TriboHub (Fase 1 — área de membros por cliente).
//
// Objetivo: servir o MESMO app estático (Cloudflare Pages) em qualquer subdomínio
// de cliente — vendas.tribohub.com.br, academia.tribohub.com.br, etc. O app é uma
// SPA estática; o subdomínio só muda o que o JS lê de window.location.hostname
// (ver apps/web/lib/tenant.ts), então o mesmo build serve todos.
//
// A rota *.tribohub.com.br/* também casa api.* — por isso o worker encaminha o
// api para a origem real (Railway), garantindo que a API não quebre com o proxy.
//
// Vars (definir no wrangler.toml / dashboard):
//   BASE_DOMAIN  = "tribohub.com.br"
//   PAGES_ORIGIN = "tribohub.pages.dev"           (deployment do front estático)
//   API_ORIGIN   = "tribo-hub-xxxx.up.railway.app" (origem real da API no Railway)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;

    // api.* → encaminha para a origem real da API (Railway), preservando tudo.
    // (Se preferir eliminar este salto, crie uma rota mais específica para api.*
    //  sem worker no dashboard; enquanto isso, este proxy mantém a API no ar.)
    const destino = host === `api.${env.BASE_DOMAIN}` ? env.API_ORIGIN : env.PAGES_ORIGIN;

    url.hostname = destino;
    url.protocol = 'https:';
    url.port = '';

    const proxied = new Request(url.toString(), request);
    proxied.headers.set('X-Forwarded-Host', host); // diagnóstico/telemetria
    return fetch(proxied);
  },
};
