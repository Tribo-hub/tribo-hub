'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { embed } from '../../../lib/video';
import { sanitizeHtml } from '../../../lib/sanitize';

interface Aula {
  id: string;
  titulo: string;
  tipoVideo: string | null;
  videoUrl: string | null;
  conteudoTexto: string | null;
  materialUrl: string | null;
  legendaUrl: string | null;
  anexos?: { nome: string; url: string }[];
  concluida: boolean;
  avaliacao: number | null;
  bloqueadaDrip: boolean;
  liberaEm: string | null;
}
interface Modulo { id: string; titulo: string; aulas: Aula[] }
interface Trilha { id: string; titulo: string; modulos: Modulo[] }
interface QuizItem { id: string; pergunta: string; minhaResposta: string | null }
interface Comentario {
  id: string;
  texto: string;
  autor: string;
  isProdutor: boolean;
  meu: boolean;
  data: string;
  respostas?: Comentario[];
}

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
  const [cor, setCor] = useState('#7c3aed');
  const [parabens, setParabens] = useState(false);

  useEffect(() => {
    api<{ conta?: { corPrimaria: string | null } }>('/me')
      .then((m) => setCor(m.conta?.corPrimaria || '#7c3aed'))
      .catch(() => {});
  }, []);
  const [legendaVtt, setLegendaVtt] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [respostasQuiz, setRespostasQuiz] = useState<Record<string, string>>({});
  const [quizSalvo, setQuizSalvo] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [comentHabilitado, setComentHabilitado] = useState(false);
  const [novoComent, setNovoComent] = useState('');
  const [aba, setAba] = useState<'quiz' | 'comentarios'>('quiz');
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [respostaTexto, setRespostaTexto] = useState('');

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

  // Carrega o quiz da aula (se houver perguntas e a aula estiver liberada).
  useEffect(() => {
    let cancelado = false;
    setQuiz([]);
    setRespostasQuiz({});
    setQuizSalvo(false);
    if (!aulaId || aula?.bloqueadaDrip) return;
    api<QuizItem[]>(`/app/aulas/${aulaId}/quiz`)
      .then((itens) => {
        if (cancelado) return;
        setQuiz(itens);
        setRespostasQuiz(Object.fromEntries(itens.map((i) => [i.id, i.minhaResposta ?? ''])));
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [aulaId, aula?.bloqueadaDrip]);

  async function salvarQuiz() {
    const respostas = quiz
      .map((p) => ({ perguntaId: p.id, resposta: (respostasQuiz[p.id] ?? '').trim() }))
      .filter((r) => r.resposta);
    if (!respostas.length) return;
    await api(`/app/aulas/${aulaId}/quiz`, { method: 'POST', body: JSON.stringify({ respostas }) });
    setQuizSalvo(true);
  }

  // Comentários da aula.
  const carregarComentarios = useCallback(async (id: string) => {
    try {
      const r = await api<{ habilitado: boolean; comentarios: Comentario[] }>(`/app/aulas/${id}/comentarios`);
      setComentHabilitado(r.habilitado);
      setComentarios(r.comentarios);
    } catch {
      setComentHabilitado(false);
      setComentarios([]);
    }
  }, []);

  useEffect(() => {
    setComentarios([]);
    setComentHabilitado(false);
    setNovoComent('');
    setRespondendo(null);
    if (aulaId && !aula?.bloqueadaDrip) carregarComentarios(aulaId);
  }, [aulaId, aula?.bloqueadaDrip, carregarComentarios]);

  async function enviarComentario() {
    if (!novoComent.trim()) return;
    await api(`/app/aulas/${aulaId}/comentarios`, { method: 'POST', body: JSON.stringify({ texto: novoComent }) });
    setNovoComent('');
    await carregarComentarios(aulaId);
  }

  async function enviarResposta(respostaAId: string) {
    if (!respostaTexto.trim()) return;
    await api(`/app/aulas/${aulaId}/comentarios`, {
      method: 'POST',
      body: JSON.stringify({ texto: respostaTexto, respostaAId }),
    });
    setRespostaTexto('');
    setRespondendo(null);
    await carregarComentarios(aulaId);
  }

  async function excluirComentario(cid: string) {
    if (!confirm('Excluir seu comentário?')) return;
    await api(`/app/comentarios/${cid}`, { method: 'DELETE' });
    await carregarComentarios(aulaId);
  }

  async function avaliar(nota: number) {
    if (!aula) return;
    await api(`/app/aulas/${aula.id}/avaliacao`, { method: 'POST', body: JSON.stringify({ nota }) });
    await carregar();
  }

  async function alternarConclusao() {
    if (!aula) return;
    const novo = !aula.concluida;
    const res = await api<{ certificadoEmitido: boolean }>('/app/progresso', {
      method: 'POST',
      body: JSON.stringify({ aulaId: aula.id, concluido: novo }),
    });
    if (novo && res.certificadoEmitido) setParabens(true);
    await carregar();
    if (novo && proxima) setAulaId(proxima.id); // ao concluir, avança; ao desmarcar, permanece
  }

  if (!trilha || !aula) {
    return <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-400">Carregando...</main>;
  }
  const player = aula.videoUrl ? embed(aula.tipoVideo ?? 'youtube', aula.videoUrl) : null;

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
          {aula.bloqueadaDrip ? (
            <div className="aspect-video bg-slate-800 rounded-xl grid place-items-center text-center px-6">
              <div>
                <p className="text-3xl mb-2">🔒</p>
                <p className="text-slate-300 font-semibold">Conteúdo bloqueado</p>
                <p className="text-slate-400 text-sm mt-1">
                  Libera em {aula.liberaEm ? new Date(aula.liberaEm).toLocaleDateString('pt-BR') : 'breve'}.
                </p>
              </div>
            </div>
          ) : player ? (
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              {player.kind === 'iframe' ? (
                <iframe src={player.src} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : (
                <video src={player.src} controls className="w-full h-full" crossOrigin="anonymous">
                  {legendaVtt && <track default kind="subtitles" srcLang="pt" label="Legendas" src={legendaVtt} />}
                </video>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">{aula.titulo}</h1>
              <p className="text-slate-400 text-sm mt-1">{trilha.titulo} › {moduloAtual?.titulo}</p>
            </div>
            {proxima && (
              <button onClick={() => setAulaId(proxima.id)} style={{ backgroundColor: cor }} className="shrink-0 inline-flex items-center gap-1 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90">
                Próxima <span aria-hidden="true">→</span>
              </button>
            )}
          </div>

          {!aula.bloqueadaDrip && aula.conteudoTexto && (
            aula.conteudoTexto.includes('<') ? (
              <div
                className="prose-conteudo mt-4 bg-slate-800 rounded-xl p-5 text-slate-200 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(aula.conteudoTexto) }}
              />
            ) : (
              <div className="mt-4 bg-slate-800 rounded-xl p-5 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                {aula.conteudoTexto}
              </div>
            )
          )}
          {!aula.bloqueadaDrip && (
            <>
              <div className="flex flex-wrap gap-3 mt-4">
                <button onClick={alternarConclusao} style={{ backgroundColor: aula.concluida ? undefined : cor }} className={`text-white text-sm font-semibold px-4 py-2 rounded-lg ${aula.concluida ? 'bg-slate-600 hover:bg-slate-500' : 'hover:opacity-90'}`}>
                  {aula.concluida ? '✓ Concluída — desmarcar' : 'Marcar como concluída'}
                </button>
                {aula.materialUrl && <a href={aula.materialUrl} target="_blank" rel="noreferrer" className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg">📄 Material de apoio</a>}
                {aula.legendaUrl && <a href={aula.legendaUrl} target="_blank" rel="noreferrer" className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-lg">💬 Legendas</a>}
              </div>

              {/* Materiais complementares (anexos) */}
              {aula.anexos && aula.anexos.length > 0 && (
                <div className="mt-4 bg-slate-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-white mb-2">📎 Materiais complementares</p>
                  <ul className="space-y-1">
                    {aula.anexos.map((an, i) => (
                      <li key={i}>
                        <a href={an.url} target="_blank" rel="noreferrer" className="text-sm text-tribo-400 hover:text-tribo-300">
                          📄 {an.nome}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Avaliação da aula */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-slate-400">Avalie esta aula:</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => avaliar(n)}
                    title={`${n} estrela${n > 1 ? 's' : ''}`}
                    className={`text-xl leading-none ${(aula.avaliacao ?? 0) >= n ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}`}
                  >
                    ★
                  </button>
                ))}
                {aula.avaliacao && <span className="text-xs text-slate-500 ml-1">você deu {aula.avaliacao}/5</span>}
              </div>

              {/* Abas: Quiz / Comentários (só quando os dois existem) */}
              {quiz.length > 0 && comentHabilitado && (
                <div className="mt-6 flex gap-2 border-b border-slate-700">
                  <button onClick={() => setAba('quiz')} className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${aba === 'quiz' ? 'border-white text-white' : 'border-transparent text-slate-400'}`}>🧠 Quiz</button>
                  <button onClick={() => setAba('comentarios')} className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${aba === 'comentarios' ? 'border-white text-white' : 'border-transparent text-slate-400'}`}>💬 Comentários</button>
                </div>
              )}

              {/* Quiz da aula */}
              {quiz.length > 0 && (!comentHabilitado || aba === 'quiz') && (
                <div className="mt-6 bg-slate-800 rounded-xl p-5 space-y-4">
                  <p className="text-sm font-semibold text-white">🧠 Quiz da aula</p>
                  {quiz.map((p, i) => (
                    <div key={p.id} className="space-y-1">
                      <label className="text-sm text-slate-300">{i + 1}. {p.pergunta}</label>
                      <textarea
                        value={respostasQuiz[p.id] ?? ''}
                        onChange={(e) => { setRespostasQuiz((r) => ({ ...r, [p.id]: e.target.value })); setQuizSalvo(false); }}
                        rows={2}
                        maxLength={2000}
                        placeholder="Sua resposta..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-tribo-500"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <button onClick={salvarQuiz} style={{ backgroundColor: cor }} className="hover:opacity-90 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                      Enviar respostas
                    </button>
                    {quizSalvo && <span className="text-xs text-emerald-400">✓ respostas salvas</span>}
                  </div>
                </div>
              )}

              {/* Comentários da aula */}
              {comentHabilitado && (quiz.length === 0 || aba === 'comentarios') && (
                <div className="mt-6 bg-slate-800 rounded-xl p-5 space-y-4">
                  <p className="text-sm font-semibold text-white">💬 Comentários</p>

                  <div className="flex gap-2">
                    <input
                      value={novoComent}
                      onChange={(e) => setNovoComent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') enviarComentario(); }}
                      placeholder="Escreva um comentário..."
                      maxLength={2000}
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-tribo-500"
                    />
                    <button onClick={enviarComentario} style={{ backgroundColor: cor }} className="hover:opacity-90 text-white text-sm font-semibold px-4 rounded-lg">
                      Comentar
                    </button>
                  </div>

                  {comentarios.length === 0 && <p className="text-xs text-slate-500">Seja o primeiro a comentar.</p>}

                  {comentarios.map((c) => (
                    <div key={c.id} className="border-t border-slate-700 pt-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs">
                            <span className={`font-semibold ${c.isProdutor ? 'text-tribo-400' : 'text-slate-200'}`}>{c.autor}</span>
                            {c.isProdutor && <span className="ml-1 text-[10px] bg-tribo-600/30 text-tribo-300 px-1.5 py-0.5 rounded">produtor</span>}
                            <span className="text-slate-500 ml-2">{new Date(c.data).toLocaleDateString('pt-BR')}</span>
                          </p>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap mt-0.5">{c.texto}</p>
                        </div>
                        <div className="flex gap-2 text-xs shrink-0">
                          <button onClick={() => { setRespondendo(respondendo === c.id ? null : c.id); setRespostaTexto(''); }} className="text-slate-400 hover:text-tribo-400">responder</button>
                          {c.meu && <button onClick={() => excluirComentario(c.id)} className="text-rose-400 hover:text-rose-300">excluir</button>}
                        </div>
                      </div>

                      {/* Respostas */}
                      {c.respostas?.map((r) => (
                        <div key={r.id} className="ml-4 pl-3 border-l border-slate-700">
                          <p className="text-xs">
                            <span className={`font-semibold ${r.isProdutor ? 'text-tribo-400' : 'text-slate-200'}`}>{r.autor}</span>
                            {r.isProdutor && <span className="ml-1 text-[10px] bg-tribo-600/30 text-tribo-300 px-1.5 py-0.5 rounded">produtor</span>}
                            <span className="text-slate-500 ml-2">{new Date(r.data).toLocaleDateString('pt-BR')}</span>
                            {r.meu && <button onClick={() => excluirComentario(r.id)} className="text-rose-400 hover:text-rose-300 ml-2">excluir</button>}
                          </p>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap mt-0.5">{r.texto}</p>
                        </div>
                      ))}

                      {respondendo === c.id && (
                        <div className="ml-4 flex gap-2">
                          <input
                            value={respostaTexto}
                            onChange={(e) => setRespostaTexto(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') enviarResposta(c.id); }}
                            placeholder="Sua resposta..."
                            maxLength={2000}
                            autoFocus
                            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-tribo-500"
                          />
                          <button onClick={() => enviarResposta(c.id)} style={{ backgroundColor: cor }} className="hover:opacity-90 text-white text-xs font-semibold px-3 rounded-lg">Responder</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="bg-slate-800 rounded-xl p-3 h-fit">
          {trilha.modulos.map((m) => (
            <div key={m.id} className="mb-3">
              <p className="text-xs uppercase tracking-wide text-slate-400 px-2 mb-1">{m.titulo}</p>
              <ul className="space-y-1 text-sm">
                {m.aulas.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => setAulaId(a.id)} className={`w-full text-left px-3 py-2 rounded-lg flex gap-2 ${a.id === aulaId ? 'bg-tribo-600/20 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                      <span>{a.bloqueadaDrip ? '🔒' : a.concluida ? '✓' : '○'}</span>{a.titulo}
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
