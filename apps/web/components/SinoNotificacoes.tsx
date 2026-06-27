'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  createdAt: string;
}
interface Resposta {
  itens: Notificacao[];
  naoLidas: number;
}

function quando(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'agora';
  if (d < 3600) return `${Math.floor(d / 60)}min`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export function SinoNotificacoes({ placement = 'bottom-right' }: { placement?: 'bottom-right' | 'top-left' }) {
  const [dados, setDados] = useState<Resposta>({ itens: [], naoLidas: 0 });
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await api<Resposta>('/me/notificacoes'));
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  // fecha ao clicar fora
  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  async function marcarTodas() {
    await api('/me/notificacoes/marcar-todas', { method: 'PATCH' });
    await carregar();
  }
  async function abrir(n: Notificacao) {
    if (!n.lida) {
      await api(`/me/notificacoes/${n.id}/lida`, { method: 'PATCH' });
      await carregar();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((a) => !a)}
        title="Notificações"
        className="relative w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 grid place-items-center hover:bg-slate-200 dark:hover:bg-slate-600"
      >
        🔔
        {dados.naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold grid place-items-center">
            {dados.naoLidas > 9 ? '9+' : dados.naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className={`absolute ${placement === 'top-left' ? 'left-0 bottom-full mb-2' : 'right-0 mt-2'} w-80 max-w-[90vw] ui-card shadow-lg z-50 overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Notificações</span>
            {dados.naoLidas > 0 && (
              <button onClick={marcarTodas} className="text-xs text-tribo-600 dark:text-tribo-400 hover:underline">
                marcar todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {dados.itens.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma notificação.</p>
            ) : (
              dados.itens.map((n) => (
                <button
                  key={n.id}
                  onClick={() => abrir(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/40 ${
                    n.lida ? '' : 'bg-tribo-50/60 dark:bg-tribo-900/10'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.lida && <span className="mt-1.5 w-2 h-2 rounded-full bg-tribo-600 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.titulo}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{n.mensagem}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{quando(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
