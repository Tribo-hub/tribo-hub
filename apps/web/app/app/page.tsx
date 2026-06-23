'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../lib/api';

interface TrilhaResumo {
  id: string;
  titulo: string;
  descricao: string;
  capaUrl: string | null;
  totalAulas: number;
  aulasConcluidas: number;
  percentual: number;
}
interface Me {
  nome: string;
  conta?: { nome: string; corPrimaria: string | null; logoUrl: string | null };
}

export default function AppHome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [trilhas, setTrilhas] = useState<TrilhaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setDark(document.documentElement.classList.contains('dark'));
    } catch {
      /* ignore */
    }
  }, []);

  function toggleTema() {
    const d = document.documentElement.classList.toggle('dark');
    setDark(d);
    try {
      localStorage.setItem('tribo_theme', d ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }

  const carregar = useCallback(async () => {
    try {
      const [m, ts] = await Promise.all([api<Me>('/me'), api<TrilhaResumo[]>('/app/trilhas')]);
      setMe(m);
      setTrilhas(ts);
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
  const marca = me?.conta?.nome || 'Tribo Hub';
  const iniciais = (me?.nome || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const continuar = trilhas.find((t) => t.percentual > 0 && t.percentual < 100) ?? trilhas[0];

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* Header white-label */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {me?.conta?.logoUrl ? (
              <img src={me.conta.logoUrl} alt={marca} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg grid place-items-center text-white font-bold" style={{ backgroundColor: cor }}>
                {marca[0]?.toUpperCase()}
              </div>
            )}
            <span className="font-bold text-slate-900 dark:text-white">{marca}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span style={{ color: cor }}>Início</span>
            <Link href="/app/certificados" className="hover:text-slate-900 dark:hover:text-white">Certificados</Link>
            <button onClick={() => { clearToken(); router.replace('/login'); }} className="hover:text-slate-900 dark:hover:text-white">Sair</button>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={toggleTema} title="Alternar tema" className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 grid place-items-center hover:bg-slate-200 dark:hover:bg-slate-600">
              {dark ? '☀️' : '🌙'}
            </button>
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center text-sm font-semibold">{iniciais}</div>
          </div>
        </div>
      </header>

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

        <div>
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Meus cursos</h3>
          {carregando ? (
            <p className="text-slate-500">Carregando...</p>
          ) : trilhas.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum curso disponível ainda.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {trilhas.map((t) => (
                <Link
                  key={t.id}
                  href={`/app/trilhas/ver?id=${t.id}`}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition"
                >
                  {t.capaUrl ? (
                    <img src={t.capaUrl} alt={t.titulo} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="h-32" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }} />
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
      </div>
    </main>
  );
}
