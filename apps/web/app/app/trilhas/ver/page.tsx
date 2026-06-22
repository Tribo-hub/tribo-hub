'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';
import { embed } from '../../../../lib/video';

interface Aula {
  id: string;
  titulo: string;
  tipoVideo: string;
  videoUrl: string;
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

export default function TrilhaAluno() {
  const router = useRouter();
  const [id, setId] = useState('');
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);
  const [trilha, setTrilha] = useState<Trilha | null>(null);
  const [aulaId, setAulaId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [parabens, setParabens] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const t = await api<Trilha>(`/app/trilhas/${id}`);
      setTrilha(t);
      setAulaId((atual) => {
        if (atual) return atual;
        const todas = t.modulos.flatMap((m) => m.aulas);
        return (todas.find((a) => !a.concluida) ?? todas[0])?.id ?? null;
      });
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

  const aulas = useMemo(() => trilha?.modulos.flatMap((m) => m.aulas) ?? [], [trilha]);
  const aulaAtual = aulas.find((a) => a.id === aulaId) ?? null;
  const concluidas = aulas.filter((a) => a.concluida).length;
  const percentual = aulas.length ? Math.round((concluidas / aulas.length) * 100) : 0;

  async function concluir() {
    if (!aulaAtual) return;
    try {
      const res = await api<{ certificadoEmitido: boolean }>('/app/progresso', {
        method: 'POST',
        body: JSON.stringify({ aulaId: aulaAtual.id, concluido: true }),
      });
      if (res.certificadoEmitido) setParabens(true);
      await carregar();
      const prox = aulas.find((a) => !a.concluida && a.id !== aulaAtual.id);
      if (prox) setAulaId(prox.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao concluir');
    }
  }

  if (!trilha) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-400">
        {erro || 'Carregando...'}
      </main>
    );
  }

  const player = aulaAtual ? embed(aulaAtual.tipoVideo, aulaAtual.videoUrl) : null;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-200">
      <header className="border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/app" className="text-sm text-slate-400 hover:text-white">
            ← {trilha.titulo}
          </Link>
          <span className="text-xs text-slate-400">{percentual}% concluído</span>
        </div>
      </header>

      {parabens && (
        <div className="bg-emerald-600 text-white text-center text-sm py-2">
          🎉 Parabéns! Você concluiu a trilha e seu certificado foi emitido —{' '}
          <Link href="/app/certificados" className="underline">
            ver certificados
          </Link>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-5 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            {player?.kind === 'iframe' ? (
              <iframe
                src={player.src}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : player ? (
              <video src={player.src} controls className="w-full h-full" />
            ) : null}
          </div>
          <h1 className="text-xl font-bold text-white mt-4">{aulaAtual?.titulo}</h1>
          <button
            onClick={concluir}
            disabled={aulaAtual?.concluida}
            className="mt-3 bg-tribo-600 hover:bg-tribo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {aulaAtual?.concluida ? '✓ Aula concluída' : 'Marcar como concluída'}
          </button>
        </div>

        <aside className="bg-slate-800 rounded-xl p-3 h-fit">
          {trilha.modulos.map((m) => (
            <div key={m.id} className="mb-3">
              <p className="text-xs uppercase tracking-wide text-slate-400 px-2 mb-1">{m.titulo}</p>
              <ul className="space-y-1 text-sm">
                {m.aulas.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setAulaId(a.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex gap-2 ${
                        a.id === aulaId ? 'bg-tribo-600/20 text-white' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{a.concluida ? '✓' : '○'}</span>
                      {a.titulo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
