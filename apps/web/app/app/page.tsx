'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../lib/api';
import { sanitizeHtml } from '../../lib/sanitize';

interface TrilhaResumo {
  id: string;
  titulo: string;
  descricao: string;
  capaUrl: string | null;
  totalAulas: number;
  aulasConcluidas: number;
  percentual: number;
}
interface Oferta {
  id: string;
  titulo: string;
  descricao: string;
  capaUrl: string | null;
  checkoutUrl: string | null;
  whatsappUrl: string | null;
}
interface Me {
  nome: string;
  conta?: {
    nome: string;
    corPrimaria: string | null;
    logoUrl: string | null;
    boasVindasAtivo?: boolean;
    mensagemBoasVindas?: string | null;
    agendaAtiva?: boolean;
    planosAtivos?: boolean;
    gamificacaoAtiva?: boolean;
  };
}

export default function AppHome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [trilhas, setTrilhas] = useState<TrilhaResumo[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [boasVindas, setBoasVindas] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [m, ts, ofs] = await Promise.all([
        api<Me>('/me'),
        api<TrilhaResumo[]>('/app/trilhas'),
        api<Oferta[]>('/app/ofertas').catch(() => []),
      ]);
      setMe(m);
      setTrilhas(ts);
      setOfertas(ofs);
      // Modal de boas-vindas: mostra 1x por sessão do navegador.
      if (m.conta?.boasVindasAtivo && m.conta.mensagemBoasVindas) {
        try {
          if (!sessionStorage.getItem('tribo_bv_visto')) {
            setBoasVindas(m.conta.mensagemBoasVindas);
            sessionStorage.setItem('tribo_bv_visto', '1');
          }
        } catch {
          setBoasVindas(m.conta.mensagemBoasVindas);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    carregar();
  }, [router, carregar]);

  const cor = me?.conta?.corPrimaria || '#7c3aed';
  const continuar = trilhas.find((t) => t.percentual > 0 && t.percentual < 100) ?? trilhas[0];
  const emAndamento = trilhas.filter((t) => t.percentual > 0 && t.percentual < 100);

  return (
    <main>
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-10">
        {erro && <p className="text-sm text-rose-600">{erro}</p>}

        {continuar && (
          <Link
            href={`/app/trilhas/ver?id=${continuar.id}`}
            className="block rounded-2xl text-white p-7"
            style={{ background: `linear-gradient(to right, #0f172a, ${cor})` }}
          >
            <p className="text-xs uppercase tracking-wide opacity-80 mb-1">Continue de onde parou</p>
            <h2 className="text-2xl font-bold">{continuar.titulo}</h2>
            <p className="text-sm opacity-90 mt-1">{continuar.aulasConcluidas} de {continuar.totalAulas} aulas concluídas</p>
            <div className="mt-4 w-full md:w-80 bg-white/20 rounded-full h-2">
              <div className="h-2 rounded-full bg-white/90" style={{ width: `${continuar.percentual}%` }} />
            </div>
            <p className="text-xs opacity-90 mt-1">{continuar.percentual}% concluído →</p>
          </Link>
        )}

        {emAndamento.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Continue assistindo</h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {emAndamento.map((t) => (
                <Link
                  key={t.id}
                  href={`/app/trilhas/ver?id=${t.id}`}
                  className="shrink-0 w-60 ui-card overflow-hidden hover:shadow-md transition"
                >
                  {t.capaUrl ? (
                    <img src={t.capaUrl} alt={t.titulo} className="h-24 w-full object-cover" />
                  ) : (
                    <div className="h-24" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }} />
                  )}
                  <div className="p-3">
                    <h4 className="font-semibold text-sm truncate">{t.titulo}</h4>
                    <div className="mt-2 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${t.percentual}%`, backgroundColor: cor }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{t.percentual}% · retomar →</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Meus cursos</h3>
          {carregando ? (
            <p className="text-slate-500">Carregando...</p>
          ) : trilhas.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum curso disponível ainda.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {trilhas.map((t) => (
                <Link
                  key={t.id}
                  href={`/app/trilhas/ver?id=${t.id}`}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition"
                >
                  {t.capaUrl ? (
                    <img src={t.capaUrl} alt={t.titulo} className="aspect-[4/5] w-full object-cover" />
                  ) : (
                    <div className="aspect-[4/5]" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }} />
                  )}
                  <div className="p-4">
                    <h4 className="font-semibold">{t.titulo}</h4>
                    <div className="mt-3 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${t.percentual}%`, backgroundColor: cor }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {t.percentual === 100 ? '✓ Concluído' : `${t.aulasConcluidas}/${t.totalAulas} aulas · ${t.percentual}%`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Ofertas (trilhas trancadas / vitrine) */}
        {ofertas.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Descubra mais</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {ofertas.map((o) => (
                <div key={o.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="relative">
                    {o.capaUrl ? (
                      <img src={o.capaUrl} alt={o.titulo} className="aspect-[4/5] w-full object-cover" />
                    ) : (
                      <div className="aspect-[4/5]" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }} />
                    )}
                    <div className="absolute inset-0 bg-black/40 grid place-items-center">
                      <span className="text-4xl">🔒</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-semibold">{o.titulo}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{(o.descricao || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')}</p>
                    <div className="flex gap-2 mt-3">
                      {o.checkoutUrl && (
                        <a href={o.checkoutUrl} target="_blank" rel="noreferrer"
                          className="flex-1 text-center text-white text-sm font-semibold py-2 rounded-lg" style={{ backgroundColor: cor }}>
                          Comprar
                        </a>
                      )}
                      {o.whatsappUrl && (
                        <a href={o.whatsappUrl} target="_blank" rel="noreferrer"
                          className="text-center text-sm font-semibold py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" title="Falar no WhatsApp">
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de boas-vindas */}
      {boasVindas && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="overflow-y-auto p-6">
              <div
                className="prose-conteudo text-slate-800 dark:text-slate-100"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(boasVindas) }}
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setBoasVindas(null)}
                className="text-white text-sm font-semibold px-6 py-2 rounded-lg"
                style={{ backgroundColor: cor }}
              >
                Começar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
