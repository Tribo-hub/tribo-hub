'use client';

// Cache leve em memória para GETs (stale-while-revalidate) + /me compartilhado.
// Objetivo "Netflix": ao voltar numa tela já visitada, mostrar o conteúdo NA HORA
// (do cache) e revalidar em segundo plano. É aditivo — quem não usar continua igual.

import { api } from './api';

interface Entrada {
  data: unknown;
  exp: number;
}
const mem = new Map<string, Entrada>();
const TTL_PADRAO = 5 * 60 * 1000; // 5 min
const TTL_ME = 30 * 1000; // /me muda pouco; 30s é seguro (o bloqueio real é enforçado no servidor)

// Lê do cache (só se ainda válido). Null se ausente/expirado.
export function lerCache<T>(key: string): T | null {
  const e = mem.get(key);
  return e && e.exp > Date.now() ? (e.data as T) : null;
}

export function gravarCache(key: string, data: unknown, ttl = TTL_PADRAO) {
  mem.set(key, { data, exp: Date.now() + ttl });
}

export function limparCache() {
  mem.clear();
}

// Prefetch silencioso (ex.: hover num card) — aquece o cache pro próximo clique abrir instantâneo.
export function prefetch(key: string) {
  if (lerCache(key)) return;
  api(key)
    .then((d) => gravarCache(key, d))
    .catch(() => {});
}

// /me compartilhado: 1 fetch por vez (dedup de chamadas concorrentes) + cache curto.
// Antes cada tela/sidebar/header buscava /me separadamente (2-4x por tela).
let meInflight: Promise<unknown> | null = null;
export async function getMe<T = unknown>(): Promise<T> {
  const cached = lerCache<T>('/me');
  if (cached) return cached;
  if (!meInflight) {
    meInflight = api('/me')
      .then((d) => {
        gravarCache('/me', d, TTL_ME);
        return d;
      })
      .finally(() => {
        meInflight = null;
      });
  }
  return meInflight as Promise<T>;
}

// Invalida o /me (chamar após editar perfil/marca para refletir na hora).
export function invalidarMe() {
  mem.delete('/me');
}
