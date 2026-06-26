'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { toast } from '../../../lib/toast';

type TipoItem = 'check' | 'assistir' | 'resumo';
interface AulaRef { id: string; titulo: string; trilhaId: string }
interface Item { id: string; titulo: string; tipo: TipoItem; prazoEm: string | null; concluido: boolean; texto: string; aula: AulaRef | null }
interface Plano { id: string; titulo: string; descricao: string | null; itens: Item[] }
interface Me { conta?: { corPrimaria: string | null } }

export default function PlanosAlunoPage() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cor, setCor] = useState('#7c3aed');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [ps, me] = await Promise.all([api<Plano[]>('/app/planos'), api<Me>('/me')]);
      setPlanos(ps);
      setCor(me.conta?.corPrimaria || '#7c3aed');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  function patchItem(planoId: string, itemId: string, patch: Partial<Item>) {
    setPlanos((ps) => ps.map((p) => p.id === planoId ? { ...p, itens: p.itens.map((i) => i.id === itemId ? { ...i, ...patch } : i) } : p));
  }

  async function marcarCheck(planoId: string, item: Item) {
    const novo = !item.concluido;
    patchItem(planoId, item.id, { concluido: novo });
    try {
      await api(`/app/planos/itens/${item.id}`, { method: 'PATCH', body: JSON.stringify({ concluido: novo }) });
    } catch {
      patchItem(planoId, item.id, { concluido: !novo });
    }
  }

  async function enviarResumo(planoId: string, item: Item) {
    if (!item.texto.trim()) return;
    try {
      await api(`/app/planos/itens/${item.id}`, { method: 'PATCH', body: JSON.stringify({ texto: item.texto }) });
      patchItem(planoId, item.id, { concluido: true });
      toast.success('Resumo enviado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar resumo');
    }
  }

  const agora = Date.now();
  const atrasado = (it: Item) => !it.concluido && it.prazoEm && new Date(it.prazoEm).getTime() < agora;
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : null);
  const linkAula = (a: AulaRef) => `/app/player?id=${a.trilhaId}&aula=${a.id}`;

  return (
    <main>
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : planos.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum plano de ação disponível no momento.</p>
        ) : planos.map((p) => {
          const feitos = p.itens.filter((i) => i.concluido).length;
          const pct = p.itens.length ? Math.round((feitos / p.itens.length) * 100) : 0;
          return (
            <div key={p.id} className="ui-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">{p.titulo}</h2>
                <span className="text-xs text-slate-400">{feitos}/{p.itens.length} · {pct}%</span>
              </div>
              {p.descricao && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{p.descricao}</p>}
              <div className="mt-2 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
              </div>

              <ul className="mt-4 space-y-3">
                {p.itens.map((it) => (
                  <li key={it.id} className="border-b border-slate-100 dark:border-slate-700 pb-3 last:border-0 last:pb-0">
                    {/* CHECK */}
                    {it.tipo === 'check' && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={it.concluido} onChange={() => marcarCheck(p.id, it)} className="w-4 h-4 shrink-0" />
                        <span className={`flex-1 text-sm ${it.concluido ? 'line-through text-slate-400' : ''}`}>{it.titulo}</span>
                        {it.prazoEm && <span className={`text-xs ${atrasado(it) ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>⏰ {fmt(it.prazoEm)}{atrasado(it) ? ' (atrasado)' : ''}</span>}
                      </label>
                    )}

                    {/* ASSISTIR */}
                    {it.tipo === 'assistir' && (
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 text-lg ${it.concluido ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>{it.concluido ? '✓' : '▶️'}</span>
                        <div className="flex-1">
                          <p className={`text-sm ${it.concluido ? 'text-slate-400' : ''}`}>{it.titulo}</p>
                          {it.aula && <Link href={linkAula(it.aula)} className="text-xs font-medium" style={{ color: cor }}>Assistir: {it.aula.titulo} →</Link>}
                          {it.concluido && <span className="text-xs text-emerald-500 ml-2">aula concluída</span>}
                        </div>
                        {it.prazoEm && <span className={`text-xs ${atrasado(it) ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>⏰ {fmt(it.prazoEm)}</span>}
                      </div>
                    )}

                    {/* RESUMO */}
                    {it.tipo === 'resumo' && (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 text-lg ${it.concluido ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>{it.concluido ? '✓' : '📝'}</span>
                          <p className={`flex-1 text-sm ${it.concluido ? 'text-slate-500' : ''}`}>{it.titulo}</p>
                          {it.prazoEm && <span className={`text-xs ${atrasado(it) ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>⏰ {fmt(it.prazoEm)}</span>}
                        </div>
                        {it.aula && <Link href={linkAula(it.aula)} className="text-xs font-medium ml-7 inline-block" style={{ color: cor }}>Assistir: {it.aula.titulo} →</Link>}
                        <textarea
                          value={it.texto}
                          onChange={(e) => patchItem(p.id, it.id, { texto: e.target.value })}
                          rows={3}
                          maxLength={5000}
                          placeholder="Escreva seu resumo da aula..."
                          className="mt-2 w-full ui-input"
                        />
                        <button onClick={() => enviarResumo(p.id, it)} style={{ backgroundColor: cor }} className="mt-1 hover:opacity-90 text-white text-xs font-semibold px-4 py-1.5 rounded-lg">
                          {it.concluido ? 'Atualizar resumo' : 'Enviar resumo'}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
