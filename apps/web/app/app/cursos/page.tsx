'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface TrilhaResumo { id: string; titulo: string; capaUrl: string | null; totalAulas: number; aulasConcluidas: number; percentual: number }
interface Oferta { id: string; titulo: string; descricao: string; capaUrl: string | null; checkoutUrl: string | null; whatsappUrl: string | null }
interface Me { conta?: { corPrimaria: string | null } }

export default function MeusCursosPage() {
  const router = useRouter();
  const [cor, setCor] = useState('#7c3aed');
  const [trilhas, setTrilhas] = useState<TrilhaResumo[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [m, ts, ofs] = await Promise.all([
        api<Me>('/me'),
        api<TrilhaResumo[]>('/app/trilhas'),
        api<Oferta[]>('/app/ofertas').catch(() => []),
      ]);
      setCor(m.conta?.corPrimaria || '#7c3aed');
      setTrilhas(ts);
      setOfertas(ofs);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); }
    } finally { setCarregando(false); }
  }, [router]);

  useEffect(() => { if (!getToken()) { router.replace('/login'); return; } carregar(); }, [router, carregar]);

  return (
    <main>
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold">Meus cursos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Todo o conteúdo das suas aulas.</p>
        </div>

        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : trilhas.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum curso disponível ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {trilhas.map((t) => (
              <Link key={t.id} href={`/app/trilhas/ver?id=${t.id}`} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition">
                {t.capaUrl ? <img src={t.capaUrl} alt={t.titulo} className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5]" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }} />}
                <div className="p-4">
                  <h4 className="font-semibold">{t.titulo}</h4>
                  <div className="mt-3 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${t.percentual}%`, backgroundColor: cor }} /></div>
                  <p className="text-xs text-slate-400 mt-1">{t.percentual === 100 ? '✓ Concluído' : `${t.aulasConcluidas}/${t.totalAulas} aulas · ${t.percentual}%`}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {ofertas.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Descubra mais</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {ofertas.map((o) => (
                <div key={o.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="relative">
                    {o.capaUrl ? <img src={o.capaUrl} alt={o.titulo} className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5]" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }} />}
                    <div className="absolute inset-0 bg-black/40 grid place-items-center"><span className="text-4xl">🔒</span></div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-semibold">{o.titulo}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{(o.descricao || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')}</p>
                    <div className="flex gap-2 mt-3">
                      {o.checkoutUrl && <a href={o.checkoutUrl} target="_blank" rel="noreferrer" className="flex-1 text-center text-white text-sm font-semibold py-2 rounded-lg" style={{ backgroundColor: cor }}>Comprar</a>}
                      {o.whatsappUrl && <a href={o.whatsappUrl} target="_blank" rel="noreferrer" className="text-center text-sm font-semibold py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white">WhatsApp</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
