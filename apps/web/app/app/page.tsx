'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../lib/api';

interface TrilhaResumo {
  id: string;
  titulo: string;
  descricao: string;
  totalAulas: number;
  aulasConcluidas: number;
  percentual: number;
}

export default function AppHome() {
  const router = useRouter();
  const [trilhas, setTrilhas] = useState<TrilhaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setTrilhas(await api<TrilhaResumo[]>('/app/trilhas'));
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

  const continuar = trilhas.find((t) => t.percentual > 0 && t.percentual < 100) ?? trilhas[0];

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-semibold">Minha área</span>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/app/certificados" className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
              Certificados
            </Link>
            <button
              onClick={() => {
                clearToken();
                router.replace('/login');
              }}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        {erro && <p className="text-sm text-rose-600">{erro}</p>}

        {continuar && (
          <Link
            href={`/app/trilhas/${continuar.id}`}
            className="block rounded-2xl bg-gradient-to-r from-slate-900 to-tribo-800 text-white p-6"
          >
            <p className="text-xs uppercase tracking-wide text-tribo-200">Continue de onde parou</p>
            <h2 className="text-2xl font-bold mt-1">{continuar.titulo}</h2>
            <div className="mt-3 w-full md:w-80 bg-white/20 rounded-full h-2">
              <div className="bg-tribo-400 h-2 rounded-full" style={{ width: `${continuar.percentual}%` }} />
            </div>
            <p className="text-xs text-slate-300 mt-1">{continuar.percentual}% concluído →</p>
          </Link>
        )}

        <div>
          <h3 className="text-lg font-bold mb-4">Minhas trilhas</h3>
          {carregando ? (
            <p className="text-slate-500">Carregando...</p>
          ) : trilhas.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhuma trilha disponível ainda.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {trilhas.map((t) => (
                <Link
                  key={t.id}
                  href={`/app/trilhas/${t.id}`}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition"
                >
                  <div className="h-28 bg-gradient-to-br from-tribo-500 to-indigo-400" />
                  <div className="p-4">
                    <h4 className="font-semibold">{t.titulo}</h4>
                    <div className="mt-3 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="bg-tribo-500 h-1.5 rounded-full" style={{ width: `${t.percentual}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {t.aulasConcluidas}/{t.totalAulas} aulas · {t.percentual}%
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
