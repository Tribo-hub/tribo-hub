'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface TrilhaCard { trilhaId: string; titulo: string; capaUrl: string | null; xp: number; nivel: number }
interface Resumo {
  ativo: boolean;
  global?: { xp: number; nivel: number; xpNivelAtual: number; xpProxNivel: number };
  trilhas?: TrilhaCard[];
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
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); }
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  const g = r?.global;
  const pctNivel = g && g.xpProxNivel ? Math.round((g.xpNivelAtual / g.xpProxNivel) * 100) : 0;

  return (
    <main>
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : !r || !r.ativo ? (
          <p className="text-slate-500 text-sm">A gamificação não está ativa nesta conta.</p>
        ) : (
          <>
            {/* Resumo geral */}
            {g && (
              <div className="rounded-2xl text-white p-6" style={{ background: `linear-gradient(to right, #0f172a, ${cor})` }}>
                <p className="text-xs uppercase tracking-wide opacity-80">Resumo geral</p>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <p className="text-xs uppercase tracking-wide opacity-80">Nível</p>
                    <p className="text-4xl font-bold">{g.nivel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide opacity-80">XP total</p>
                    <p className="text-2xl font-bold">{g.xp}</p>
                  </div>
                </div>
                <div className="mt-4 bg-white/20 rounded-full h-2"><div className="h-2 rounded-full bg-white/90" style={{ width: `${pctNivel}%` }} /></div>
                <p className="text-xs opacity-90 mt-1">{g.xpNivelAtual}/{g.xpProxNivel} XP para o nível {g.nivel + 1}</p>
              </div>
            )}

            {/* Cards por trilha */}
            <div>
              <h3 className="text-lg font-bold mb-3">Sua pontuação por trilha</h3>
              {!r.trilhas || r.trilhas.length === 0 ? (
                <p className="text-slate-500 text-sm">Você ainda não está matriculado em nenhuma trilha.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {r.trilhas.map((t) => (
                    <Link key={t.trilhaId} href={`/app/conquistas/ver?id=${t.trilhaId}`} className="ui-card overflow-hidden hover:shadow-md transition">
                      <div className="relative">
                        {t.capaUrl ? (
                          <img src={t.capaUrl} alt={t.titulo} className="aspect-[4/5] w-full object-cover" />
                        ) : (
                          <div className="aspect-[4/5]" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }} />
                        )}
                        <span className="absolute top-2 left-2 text-[11px] font-bold bg-black/55 text-white px-2 py-0.5 rounded-full">Nível {t.nivel}</span>
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold leading-tight truncate">{t.titulo}</h4>
                        <p className="text-sm font-semibold mt-1" style={{ color: cor }}>{t.xp} XP</p>
                        <p className="text-xs text-slate-400 mt-0.5">Ver nível, badges e ranking →</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
