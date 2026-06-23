'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';

interface Aula {
  id: string;
  titulo: string;
  tipoVideo: string;
  duracaoSegundos: number;
  concluida: boolean;
  ordem: number;
}
interface Modulo {
  id: string;
  titulo: string;
  ordem: number;
  aulas: Aula[];
}
interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  modulos: Modulo[];
}
interface Me {
  conta?: { nome: string; corPrimaria: string | null };
}

function dur(s: number) {
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return `${m}:${String(seg).padStart(2, '0')}`;
}

export default function TrilhaOverview() {
  const router = useRouter();
  const [id, setId] = useState('');
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);
  const [trilha, setTrilha] = useState<Trilha | null>(null);
  const [cor, setCor] = useState('#7c3aed');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const [t, m] = await Promise.all([api<Trilha>(`/app/trilhas/${id}`), api<Me>('/me')]);
      setTrilha(t);
      setCor(m.conta?.corPrimaria || '#7c3aed');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    carregar();
  }, [router, carregar]);

  const { percentual, proximaAulaId } = useMemo(() => {
    const aulas = trilha?.modulos.flatMap((m) => m.aulas) ?? [];
    const done = aulas.filter((a) => a.concluida).length;
    const prox = aulas.find((a) => !a.concluida) ?? aulas[0];
    return {
      percentual: aulas.length ? Math.round((done / aulas.length) * 100) : 0,
      proximaAulaId: prox?.id,
    };
  }, [trilha]);

  if (!trilha) {
    return <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 text-slate-500">{erro || 'Carregando...'}</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/app" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">← Meus cursos</Link>
          {proximaAulaId && (
            <Link href={`/app/player?id=${trilha.id}&aula=${proximaAulaId}`} className="text-white text-sm font-semibold px-4 py-2 rounded-lg" style={{ backgroundColor: cor }}>
              ▶ Continuar
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{trilha.titulo}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{trilha.descricao}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div className="h-2.5 rounded-full" style={{ width: `${percentual}%`, backgroundColor: cor }} />
          </div>
          <span className="text-sm font-semibold">{percentual}%</span>
        </div>

        <div className="space-y-3 mt-6">
          {trilha.modulos.map((m, i) => {
            const total = m.aulas.length;
            const done = m.aulas.filter((a) => a.concluida).length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const prev = trilha.modulos[i - 1];
            const prevPct = prev ? (prev.aulas.length ? (prev.aulas.filter((a) => a.concluida).length / prev.aulas.length) * 100 : 100) : 100;
            const locked = i > 0 && prevPct < 80;
            return (
              <div key={m.id} className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${locked ? 'opacity-70' : ''}`}>
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 rounded-t-xl">
                  <span className="font-semibold">{m.titulo}</span>
                  {locked ? (
                    <span className="text-xs text-slate-400">🔒 Conclua o módulo anterior</span>
                  ) : pct === 100 ? (
                    <span className="text-xs text-emerald-600 font-medium">✓ 100%</span>
                  ) : (
                    <span className="text-xs font-medium" style={{ color: cor }}>{pct > 0 ? `Em andamento · ${pct}%` : 'Não iniciado'}</span>
                  )}
                </div>
                {!locked && (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                    {m.aulas.map((a) => (
                      <li key={a.id}>
                        <Link href={`/app/player?id=${trilha.id}&aula=${a.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <span className={a.concluida ? 'text-emerald-500' : 'text-slate-300'}>{a.concluida ? '✓' : '○'}</span>
                          {a.titulo}
                          <span className="ml-auto text-slate-400 text-xs">{dur(a.duracaoSegundos)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
