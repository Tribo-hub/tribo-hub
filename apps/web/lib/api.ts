const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

const TOKEN_KEY = 'tribo_token';
const REFRESH_KEY = 'tribo_refresh';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string) {
  try { localStorage.setItem(REFRESH_KEY, token); } catch { /* ignore */ }
}

// Guarda os dois tokens (usar no login/aceitar-convite/signup).
export function setSessao(accessToken: string, refreshToken?: string) {
  setToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  try { localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem('tribo_marca'); } catch { /* ignore */ }
}

// Renovação do access token via refresh token (uma tentativa por vez, compartilhada).
let refreshEmAndamento: Promise<boolean> | null = null;
async function renovarToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshEmAndamento) {
    refreshEmAndamento = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data?.accessToken) setToken(data.accessToken);
        if (data?.refreshToken) setRefreshToken(data.refreshToken);
        return !!data?.accessToken;
      } catch {
        return false;
      } finally {
        refreshEmAndamento = null;
      }
    })();
  }
  return refreshEmAndamento;
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
  _jaRenovou = false,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });

  // Token expirado: tenta renovar uma vez e repete a requisição.
  if (res.status === 401 && !_jaRenovou && getRefreshToken() && path !== '/auth/refresh' && path !== '/auth/login') {
    if (await renovarToken()) return api<T>(path, opts, true);
  }

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Sobe um arquivo direto ao Storage via URL assinada e devolve o caminho salvo.
export async function uploadArquivo(pasta: string, file: File): Promise<string> {
  const { path, signedUrl } = await api<{ path: string; token: string; signedUrl: string }>(
    '/painel/upload/signed-url',
    { method: 'POST', body: JSON.stringify({ pasta, nomeArquivo: file.name }) },
  );
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new ApiError('Falha ao enviar o arquivo', res.status);
  return path;
}

// Sobe o avatar do próprio usuário (acessível ao aluno) e devolve o caminho salvo.
export async function uploadAvatar(file: File): Promise<string> {
  const { path, signedUrl } = await api<{ path: string; token: string; signedUrl: string }>(
    '/me/avatar-upload-url',
    { method: 'POST', body: JSON.stringify({ nomeArquivo: file.name }) },
  );
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new ApiError('Falha ao enviar a imagem', res.status);
  return path;
}

// Gera uma URL assinada de leitura para um caminho do Storage (preview no painel).
export async function urlAssinada(path: string): Promise<string> {
  const { url } = await api<{ url: string }>(`/painel/upload/signed-download?path=${encodeURIComponent(path)}`);
  return url;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
