// Descobre o tenant (área de membros do cliente) a partir do hostname do navegador.
// O front é estático e único (mesmo bundle servido em app.tribohub.com.br e em
// qualquer vendas.tribohub.com.br); quem define o tenant é o subdomínio acessado.
// O slug resolvido é enviado à API no header X-Tenant-Slug (ver lib/api.ts).

const BASE_DOMAIN = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN || 'tribohub.com.br';

// Subdomínios de função da plataforma — não são clientes.
const RESERVADOS = new Set(['app', 'www', 'admin', 'api', 'docs', 'status']);

// Retorna o slug do tenant pelo subdomínio, ou null (domínio base, reservado, dev).
export function tenantDoHost(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();

  // dev / previews: sem tenant por host (usa o campo do formulário como fallback)
  if (host === 'localhost' || host.endsWith('.localhost') || /^[\d.]+$/.test(host) || host.endsWith('.pages.dev')) {
    return null;
  }

  // subdomínio do domínio base: vendas.tribohub.com.br -> "vendas"
  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const label = host.slice(0, -(BASE_DOMAIN.length + 1));
    // só o primeiro rótulo (ignora subníveis) e descarta reservados
    const slug = label.split('.').pop() || '';
    return slug && !RESERVADOS.has(slug) ? slug : null;
  }

  // domínio próprio (area.cliente.com) — resolvido por Host na Fase 2; por ora, sem tenant.
  return null;
}
