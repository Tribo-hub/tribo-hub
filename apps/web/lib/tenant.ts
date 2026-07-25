// Descobre o tenant (área de membros do cliente) a partir do hostname do navegador.
// O front é estático e único (mesmo bundle servido em app.tribohub.com.br, em
// vendas.tribohub.com.br e em domínios próprios como area.cliente.com); quem define o
// tenant é o endereço acessado. O slug resolvido vai à API no header X-Tenant-Slug.
//
//  - Subdomínio do domínio base (Fase 1): o slug É o rótulo do subdomínio (síncrono).
//  - Domínio próprio (Fase 2): o slug não é dedutível do host; é resolvido via
//    GET /publico/marca?host=... (ver useMarcaPublica) e memorizado aqui.

const BASE_DOMAIN = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN || 'tribohub.com.br';
const RESERVADOS = new Set(['app', 'www', 'admin', 'api', 'docs', 'status']);
const CHAVE_SLUG_CUSTOM = 'tribo_tenant_slug'; // { host, slug }

function hostname(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.hostname.toLowerCase();
}

function ehDevOuPreview(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost') || /^[\d.]+$/.test(host) || host.endsWith('.pages.dev');
}

// Slug pelo subdomínio do domínio base (Fase 1). Null em domínio base/próprio/dev.
export function tenantDoHost(): string | null {
  const host = hostname();
  if (!host || ehDevOuPreview(host)) return null;
  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const label = host.slice(0, -(BASE_DOMAIN.length + 1));
    const slug = label.split('.').pop() || '';
    return slug && !RESERVADOS.has(slug) ? slug : null;
  }
  return null;
}

// Hostname quando é um DOMÍNIO PRÓPRIO de cliente (Fase 2); null caso contrário.
export function hostCustom(): string | null {
  const host = hostname();
  if (!host || ehDevOuPreview(host)) return null;
  if (host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`)) return null; // é da plataforma
  return host;
}

// Memoriza o slug resolvido para o domínio próprio atual (usado pelo header da API).
export function salvarSlugCustom(host: string, slug: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHAVE_SLUG_CUSTOM, JSON.stringify({ host, slug }));
  } catch {
    /* ignore */
  }
}

function lerSlugCustom(): string | null {
  if (typeof window === 'undefined') return null;
  const host = hostCustom();
  if (!host) return null;
  try {
    const r = localStorage.getItem(CHAVE_SLUG_CUSTOM);
    if (!r) return null;
    const o = JSON.parse(r) as { host?: string; slug?: string };
    return o?.host === host && o?.slug ? o.slug : null;
  } catch {
    return null;
  }
}

// Slug que a API deve receber no header X-Tenant-Slug (subdomínio ou domínio próprio já resolvido).
export function slugParaHeader(): string | null {
  return tenantDoHost() ?? lerSlugCustom();
}

// Há um tenant definido pelo endereço (subdomínio OU domínio próprio)?
export function temTenantPorHost(): boolean {
  return !!tenantDoHost() || !!hostCustom();
}
