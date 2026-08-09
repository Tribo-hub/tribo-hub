// Cache da marca do tenant (nome/cor/logo) no navegador para evitar o "flash"
// da marca padrão (Tribo Hub) antes de o /me responder.
//
// Chaveado POR DOMÍNIO: cada endereço (app.tribohub.com.br, cliente.tribohub.com.br,
// app.cliente.com.br) guarda a sua própria marca — assim, ao alternar entre tenants,
// nunca aparece a marca do cliente errado. Persiste no logout (é marca pública).

export interface MarcaCache {
  nome: string;
  corPrimaria: string | null;
  logoUrl: string | null;
}

function chave(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return `tribo_marca:${host}`;
}

export function lerMarca(): MarcaCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const r = localStorage.getItem(chave());
    return r ? (JSON.parse(r) as MarcaCache) : null;
  } catch {
    return null;
  }
}

export function salvarMarca(conta: { nome?: string; corPrimaria?: string | null; logoUrl?: string | null } | undefined | null) {
  if (typeof window === 'undefined' || !conta?.nome) return;
  try {
    localStorage.setItem(
      chave(),
      JSON.stringify({ nome: conta.nome, corPrimaria: conta.corPrimaria ?? null, logoUrl: conta.logoUrl ?? null }),
    );
  } catch {
    /* ignore */
  }
}

export function limparMarca() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(chave());
  } catch {
    /* ignore */
  }
}

// Aplica a cor da marca na variável CSS global usada pelo app (--cor-primaria).
export function aplicarCorMarca(cor: string | null | undefined) {
  if (typeof window === 'undefined') return;
  try {
    document.documentElement.style.setProperty('--cor-primaria', cor || '#7c3aed');
  } catch {
    /* ignore */
  }
}
