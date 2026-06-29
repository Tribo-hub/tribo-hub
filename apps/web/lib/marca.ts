// Cache da marca do tenant (nome/cor/logo) no navegador para evitar o "flash"
// da marca padrão (Tribo Hub) antes de o /me responder no login.

export interface MarcaCache {
  nome: string;
  corPrimaria: string | null;
  logoUrl: string | null;
}

const KEY = 'tribo_marca';

export function lerMarca(): MarcaCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as MarcaCache) : null;
  } catch {
    return null;
  }
}

export function salvarMarca(conta: { nome?: string; corPrimaria?: string | null; logoUrl?: string | null } | undefined | null) {
  if (typeof window === 'undefined' || !conta?.nome) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ nome: conta.nome, corPrimaria: conta.corPrimaria ?? null, logoUrl: conta.logoUrl ?? null }));
  } catch {
    /* ignore */
  }
}

export function limparMarca() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
