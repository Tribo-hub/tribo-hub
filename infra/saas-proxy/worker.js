// Worker "fallback origin" do Cloudflare for SaaS — domínio próprio do cliente (Fase 2 nível 2).
//
// Roda numa ZONA DEDICADA (ex.: apptribohub.com.br), separada da zona principal
// (tribohub.com.br), justamente para NÃO ficar na frente da API nem do site de marketing.
// Nesta zona só chega tráfego dos domínios de cliente (custom hostnames) + o fallback origin.
//
// Fluxo: cliente cria CNAME area.cliente.com -> origin.apptribohub.com.br (o "alvo fixo").
// A Cloudflare (for SaaS) valida o hostname e emite o SSL, e entrega o tráfego a este Worker,
// que serve o MESMO app estático do Pages. O app lê window.location.hostname = area.cliente.com
// (ver apps/web/lib/tenant.ts), descobre o tenant por /publico/marca?host=... e chama a API
// direto em api.tribohub.com.br (CORS já libera domínios próprios cadastrados).
//
// Var: PAGES_ORIGIN = "tribohub.pages.dev" (deployment do front estático).

export default {
  async fetch(request, env) {
    const hostOriginal = new URL(request.url).hostname;

    // Reescreve o destino para o Pages, preservando path/query/método/corpo.
    const url = new URL(request.url);
    url.hostname = env.PAGES_ORIGIN;
    url.protocol = 'https:';
    url.port = '';

    const proxied = new Request(url.toString(), request);
    proxied.headers.set('X-Forwarded-Host', hostOriginal); // diagnóstico
    return fetch(proxied);
  },
};
