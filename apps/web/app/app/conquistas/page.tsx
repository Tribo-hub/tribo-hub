'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface Badge { id: string; nome: string; icone: string; conquistada: boolean; criterio: string; atual: number; meta: number }
interface RankItem { posicao: number; nome: string; xp: number; eu: boolean }
interface Resumo {
  ativo: boolean;
  xp: number;
  nivel: number;
  xpNivelAtual: number;
  xpProxNivel: number;
  aulas: number;
  certificados: number;
  badges: Badge[];
  ranking: RankItem[];
  minhaPosicao: number;
}
interface Me { conta?: { corPrimaria: string | null } }

export default function ConquistasPage() {
  const router = useRouter();
  const [r, setR] = useState<Resumo | null>(null);
  const [cor, setCor] = useState('#7c3aed');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [res, me] = await Promise.all([api<Resumo>('/app/conquistas'), api<Me>('/me')]);
      setR(res);
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

  const pctNivel = r && r.ativo ? Math.round((r.xpNivelAtual / r.xpProxNivel) * 100) : 0;

  return (
    <main>
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : !r || !r.ativo ? (
          <p className="text-slate-500 text-sm">A gamificação não está ativa nesta conta.</p>
        ) : (
          <>
            {/* Nível e XP */}
            <div className="rounded-2xl text-white p-6" style={{ background: `linear-gradient(to right, #0f172a, ${cor})` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-80">Nível</p>
                  <p className="text-4xl font-bold">{r.nivel}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide opacity-80">XP total</p>
                  <p className="text-2xl font-bold">{r.xp}</p>
                </div>
              </div>
              <div className="mt-4 bg-white/20 rounded-full h-2">
                <div className="h-2 rounded-full bg-white/90" style={{ width: `${pctNivel}%` }} />
              </div>
              <p className="text-xs opacity-90 mt-1">{r.xpNivelAtual}/{r.xpProxNivel} XP para o nível {r.nivel + 1}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="ui-card p-5">
                <p className="text-xs text-slate-500 dark:text-slate-400">Aulas concluídas</p>
                <p className="text-2xl font-bold mt-1">{r.aulas}</p>
              </div>
              <div className="ui-card p-5">
                <p className="text-xs text-slate-500 dark:text-slate-400">Certificados</p>
                <p className="text-2xl font-bold mt-1">{r.certificados}</p>
              </div>
            </div>

            {/* Badges */}
            <div>
              <h3 className="text-lg font-bold mb-3">Badges</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {r.badges.map((b) => (
                  <div key={b.id} className={`rounded-xl border p-4 text-center ${b.conquistada ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-slate-100 dark:bg-slate-800/40 border-dashed border-slate-300 dark:border-slate-700'}`}>
                    <div className={`text-3xl ${b.conquistada ? '' : 'grayscale opacity-50'}`}>{b.conquistada ? b.icone : '🔒'}</div>
                    <p className="text-sm font-medium mt-1">{b.nome}</p>
                    {b.conquistada ? (
                      <p className="text-[11px] text-emerald-500 font-medium">✓ conquistada</p>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-400">{b.criterio}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{Math.min(b.atual, b.meta)}/{b.meta}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking */}
            <div>
              <h3 className="text-lg font-bold mb-3">Ranking</h3>
              <div className="ui-card divide-y divide-slate-100 dark:divide-slate-700">
                {r.ranking.length === 0 ? (
                  <p className="p-4 text-center text-slate-400 text-sm">Sem pontuações ainda.</p>
                ) : r.ranking.map((it) => (
                  <div key={it.posicao} className={`flex items-center justify-between px-4 py-3 ${it.eu ? 'bg-tribo-50 dark:bg-tribo-900/20' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center font-bold text-slate-400">{it.posicao}º</span>
                      <span className="text-sm font-medium">{it.nome}{it.eu ? ' (você)' : ''}</span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: cor }}>{it.xp} XP</span>
                  </div>
                ))}
              </div>
              {r.minhaPosicao > 10 && <p className="text-xs text-slate-400 mt-2">Sua posição: {r.minhaPosicao}º</p>}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
