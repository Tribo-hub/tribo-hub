const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

const TOKEN_KEY = 'tribo_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
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
