'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { embed } from '../../../lib/video';

interface Aula {
  id: string;
  titulo: string;
  tipoVideo: string;
  videoUrl: string;
  materialUrl: string | null;
  legendaUrl: string | null;
  concluida: boolean;
}
interface Modulo { id: string; titulo: string; aulas: Aula[] }
interface Trilha { id: string; titulo: string; modulos: Modulo[] }

// Converte SRT para WebVTT (o <track> nativo só lê VTT). Se já for VTT, mantém.
function srtParaVtt(txt: string): string {
  if (txt.trimStart().startsWith('WEBVTT')) return txt;
  return 'WEBVTT\n\n' + txt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

export default function PlayerPage() {
  const router = useRouter();
  const [trilhaId, setTrilhaId] = useState('');
  const [aulaId, setAulaId] = useState('');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setTrilhaId(p.get('id') ?? '');
    setAulaId(p.get('aula') ?? '');
  }, []);

  const [trilha, setTrilha] = useState<Trilha | null>(null);
  const [parabens, setParabens] = useState(false);
  const [legendaVtt, setLegendaVtt] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!trilhaId) return;
    try {
      const t = await api<Trilha>(`/app/trilhas/${trilhaId}`);
      setTrilha(t);
      setAulaId((atual) => atual || t.modulos.flatMap((m) => m.aulas)[0]?.id || '');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    }
  }, [trilhaId, router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  const aulas = useMemo(() => trilha?.modulos.flatMap((m) => m.aulas) ?? [], [trilha]);
  const aula = aulas.find((a) => a.id === aulaId) ?? null;
  const moduloAtual = trilha?.modulos.find((m) => m.aulas.some((a) => a.id === aulaId));
  const idx = aulas.findIndex((a) => a.id === aulaId);
  const proxima = aulas.find((a, i) => i > idx && !a.concluida) ?? aulas[idx + 1];
  const legendaArquivo = aula?.legendaUrl ?? null;

  // Carrega a legenda (SRT/VTT) e expõe como <track> via blob. Fallback: botão de download.
  useEffect(() => {
    let url: string | null = null;
    let cancelado = false;
    setLegendaVtt(null);
    if (legendaArquivo) {
      fetch(legendaArquivo)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error('falha'))))
        .then((txt) => {
          if (cancelado) return;
          url = URL.createObjectURL(new Blob([srtParaVtt(txt)], { type: 'text/vtt' }));
          setLegendaVtt(url);
        })
        .catch(() => {});
    }
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [legendaArquivo]);

  async function concluir() {
    if (!aula) return;
    const res = await api<{ certificadoEmitido: boolean }>('/app/progresso', {
      method: 'POST',
      body: JSON.stringify({ aulaId: aula.id, concluido: true }),
    });
    if (res.certificadoEmitido) setParabens(true);
    await carregar();
    if (proxima) setAulaId(proxima.id);
  }

  if (!trilha || !aula) {
    return <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-400">Carregando...</main>;
  }
  const player = embed(aula.tipoVideo, aula.videoUrl);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-200">
      <header className="border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href={`/app/trilhas/ver?id=${trilha.id}`} className="text-sm text-slate-400 hover:text-white">← {trilha.titulo}</Link>
          <span className="text-xs text-slate-400">{moduloAtual?.titulo}</span>
        </div>
      </header>

      {parabens && (
        <div className="bg-emerald-600 text-white text-center text-sm py-2">
          🎉 Parabéns! Você concluiu a trilha — <Link href="/app/certificados" className="underline">ver certificado</Link>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-5 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            {player.kind === 'iframe' ? (
              <iframe src={player.src} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            ) : (
              <video src={player.src} controls className="w-full h-full" crossOrigin="anonymous">
                {legendaVtt && <track default kind="subtitles" srcLang="pt" label="Legendas" src={legendaVtt} />}
              </video>
            )}
          </div>
          <h1 className="text-xl font-bold text-white mt-4">{aula.titulo}</h1>
          <p className="text-slate-400 text-sm mt-1">{trilha.titulo} › {moduloAtual?.titulo}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={concluir} disabled={aula.concluida} className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              {aula.concluida ? '✓ Aula concluída' : 'Marcar como concluída'}
            </button>
            {aula.materialUrl && <a href={aula.materialUrl} target="_blank" rel="noreferrer" className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg">📄 Material de apoio</a>}
            {aula.legendaUrl && <a href={aula.legendaUrl} target="_blank" rel="noreferrer" className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg">💬 Legendas</a>}
          </div>
        </div>

        <aside className="bg-slate-800 rounded-xl p-3 h-fit">
          {trilha.modulos.map((m) => (
            <div key={m.id} className="mb-3">
              <p className="text-xs uppercase tracking-wide text-slate-400 px-2 mb-1">{m.titulo}</p>
              <ul className="space-y-1 text-sm">
                {m.aulas.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => setAulaId(a.id)} className={`w-full text-left px-3 py-2 rounded-lg flex gap-2 ${a.id === aulaId ? 'bg-tribo-600/20 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                      <span>{a.concluida ? '✓' : '○'}</span>{a.titulo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {proxima && (
            <button onClick={() => setAulaId(proxima.id)} className="w-full mt-2 bg-white text-slate-900 font-semibold py-2 rounded-lg text-sm">Próxima aula →</button>
          )}
        </aside>
      </div>
    </main>
  );
}
