'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../lib/api';
import { sanitizeHtml } from '../../lib/sanitize';

interface TrilhaResumo { id: string; titulo: string; descricao: string; capaUrl: string | null; totalAulas: number; aulasConcluidas: number; percentual: number }
interface Oferta { id: string; titulo: string; descricao: string; capaUrl: string | null; checkoutUrl: string | null; whatsappUrl: string | null }
interface Me { nome: string; conta?: { nome: string; corPrimaria: string | null; boasVindasAtivo?: boolean; mensagemBoasVindas?: string | null } }

interface Opcao { valor: string; label: string; temPlanos: boolean }
interface PlanoJ { id: string; ordem: number; titulo: string; subtitulo: string | null; status: string; bloqueado: boolean; releasedAt: string | null; prazoEm: string | null; percentual: number; totalItens: number; concluidos: number; entregue: boolean; temAnalise: boolean }
interface ItemAtual { id: string; titulo: string; tipo: string; concluido: boolean; aulaId: string | null; aulaTrilhaId: string | null }
interface Atual { id: string; titulo: string; subtitulo: string | null; prazoEm: string | null; totalItens: number; concluidos: number; percentual: number; itens: ItemAtual[] }
interface ProximoPasso { label: string; kind: 'aula' | 'plano'; aulaId?: string; trilhaId?: string; planoId: string }
interface Live { titulo: string; inicioEm: string; linkAcesso: string }
interface Jornada {
  opcoes: Opcao[]; sel: string; temPlanos: boolean; nivel: number | null; xp: number | null;
  proximaLive: Live | null; planos: PlanoJ[]; percentualJornada: number; atual: Atual | null; proximoPasso: ProximoPasso | null;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
const STATUS_LABEL: Record<string, string> = { entregue: 'concluído', em_andamento: 'em andamento', atrasado: 'atrasado', bloqueado: 'bloqueado', disponivel: 'disponível' };

export default function AppHome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [trilhas, setTrilhas] = useState<TrilhaResumo[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [boasVindas, setBoasVindas] = useState<string | null>(null);
  const [vista, setVista] = useState<'foco' | 'linha'>(() => {
    if (typeof window === 'undefined') return 'foco';
    return (localStorage.getItem('tribo_jornada_vista') as 'foco' | 'linha') || 'foco';
  });

  const carregar = useCallback(async () => {
    try {
      const [m, jor, ts, ofs] = await Promise.all([
        api<Me>('/me'),
        api<Jornada>('/app/jornada').catch(() => null),
        api<TrilhaResumo[]>('/app/trilhas'),
        api<Oferta[]>('/app/ofertas').catch(() => []),
      ]);
      setMe(m); setJornada(jor); setTrilhas(ts); setOfertas(ofs);
      if (m.conta?.boasVindasAtivo && m.conta.mensagemBoasVindas) {
        try {
          if (!sessionStorage.getItem('tribo_bv_visto')) { setBoasVindas(m.conta.mensagemBoasVindas); sessionStorage.setItem('tribo_bv_visto', '1'); }
        } catch { setBoasVindas(m.conta.mensagemBoasVindas); }
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); return; }
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally { setCarregando(false); }
  }, [router]);

  useEffect(() => { if (!getToken()) { router.replace('/login'); return; } carregar(); }, [router, carregar]);

  async function selecionar(valor: string) {
    try { setJornada(await api<Jornada>(`/app/jornada?sel=${valor}`)); } catch { /* mantém */ }
  }
  function trocarVista(v: 'foco' | 'linha') {
    setVista(v);
    try { localStorage.setItem('tribo_jornada_vista', v); } catch { /* ignore */ }
  }

  const cor = me?.conta?.corPrimaria || '#7c3aed';
  const temJornada = !!jornada && jornada.opcoes.some((o) => o.temPlanos);

  // hrefs (cliques direcionados)
  const passoHref = (pp: ProximoPasso) => (pp.kind === 'aula' ? `/app/player?id=${pp.trilhaId}&aula=${pp.aulaId}` : `/app/planos/ver?id=${pp.planoId}`);
  const itemHref = (it: ItemAtual, planoId: string) => (it.aulaId ? `/app/player?id=${it.aulaTrilhaId}&aula=${it.aulaId}` : `/app/planos/ver?id=${planoId}`);
  const pillCls = (s: string) =>
    s === 'entregue' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : s === 'atrasado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    : s === 'bloqueado' ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

  // Cursos (sempre disponíveis embaixo + fallback quando não há jornada)
  const continuar = trilhas.find((t) => t.percentual > 0 && t.percentual < 100) ?? trilhas[0];

  const cursosSection = (
    <div>
      <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Meus cursos</h3>
      {carregando ? <p className="text-slate-500">Carregando...</p> : trilhas.length === 0 ? (
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
    </div>
  );

  const ofertasSection = ofertas.length > 0 && (
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
  );

  return (
    <main>
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-10">
        {erro && <p className="text-sm text-rose-600">{erro}</p>}

        {temJornada && jornada ? (
          <>
            {/* Cabeçalho da jornada */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {jornada.opcoes.length > 1 && (
                    <select value={jornada.sel} onChange={(e) => selecionar(e.target.value)} className="ui-input text-sm py-1.5">
                      {jornada.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.label}{o.temPlanos ? '' : ' (só aulas)'}</option>)}
                    </select>
                  )}
                  {jornada.nivel != null && (
                    <Link href="/app/conquistas" className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ backgroundColor: `color-mix(in srgb, ${cor} 15%, transparent)`, color: cor }}>
                      ⚡ Nível {jornada.nivel} · {jornada.xp} XP
                    </Link>
                  )}
                </div>
                {jornada.temPlanos && (
                  <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 p-0.5 text-sm">
                    <button onClick={() => trocarVista('foco')} className={`px-3 py-1.5 rounded-md font-medium ${vista === 'foco' ? 'text-white' : 'text-slate-500'}`} style={vista === 'foco' ? { backgroundColor: cor } : undefined}>Missão em foco</button>
                    <button onClick={() => trocarVista('linha')} className={`px-3 py-1.5 rounded-md font-medium ${vista === 'linha' ? 'text-white' : 'text-slate-500'}`} style={vista === 'linha' ? { backgroundColor: cor } : undefined}>Linha do tempo</button>
                  </div>
                )}
              </div>

              {!jornada.temPlanos ? (
                <div className="ui-card p-6 text-sm text-slate-500 dark:text-slate-400">Esta trilha não tem plano de ação. Veja o conteúdo em <b>Meus cursos</b> abaixo.</div>
              ) : (
                <>
                  {/* barra de jornada + próximo passo (comum às duas visões) */}
                  <div className="ui-card p-5">
                    <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-1">
                      <span>Sua jornada — <b className="text-slate-800 dark:text-slate-100">{jornada.atual ? jornada.atual.titulo : `${jornada.planos.length} etapas`}</b></span>
                      <span><b className="text-slate-800 dark:text-slate-100">{jornada.percentualJornada}%</b> concluído</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: `color-mix(in srgb, ${cor} 16%, transparent)` }}>
                      <div className="h-full rounded-full" style={{ width: `${jornada.percentualJornada}%`, backgroundColor: cor }} />
                    </div>
                    {jornada.proximoPasso && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl p-3" style={{ backgroundColor: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
                        <div className="flex-1 min-w-[180px]">
                          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cor }}>▶ Próximo passo</p>
                          <p className="font-semibold mt-0.5">{jornada.proximoPasso.label}</p>
                          {jornada.atual?.prazoEm && <p className="text-xs text-amber-600 mt-0.5">⏰ vence {fmt(jornada.atual.prazoEm)}</p>}
                        </div>
                        <Link href={passoHref(jornada.proximoPasso)} className="text-white text-sm font-semibold px-4 py-2 rounded-lg" style={{ backgroundColor: cor }}>Continuar agora →</Link>
                      </div>
                    )}
                  </div>

                  {vista === 'foco' ? (
                    /* ===== V2: MISSÃO EM FOCO ===== */
                    <div className="mt-4 grid lg:grid-cols-[1.5fr_1fr] gap-4">
                      {jornada.atual ? (
                        <div className="ui-card p-6" style={{ borderColor: `color-mix(in srgb, ${cor} 40%, transparent)` }}>
                          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cor }}>Sua missão agora</p>
                          <h2 className="text-2xl font-bold tracking-tight mt-1">{jornada.atual.titulo}</h2>
                          {jornada.atual.subtitulo && <p className="text-sm text-slate-500 dark:text-slate-400">{jornada.atual.subtitulo}</p>}
                          <div className="my-4 flex items-center gap-4">
                            <div className="w-[70px] h-[70px] rounded-full grid place-items-center shrink-0" style={{ background: `conic-gradient(${cor} ${jornada.atual.percentual}%, color-mix(in srgb, ${cor} 15%, transparent) 0)` }}>
                              <div className="w-[54px] h-[54px] rounded-full bg-white dark:bg-slate-800 grid place-items-center text-sm font-extrabold">{jornada.atual.concluidos}/{jornada.atual.totalItens}</div>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{jornada.atual.percentual}% das tarefas concluídas</p>
                          </div>
                          <div className="space-y-1.5">
                            {jornada.atual.itens.map((it) => (
                              <Link key={it.id} href={itemHref(it, jornada.atual!.id)} className={`flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 ${it.concluido ? 'text-slate-400' : ''}`}>
                                <span className={`w-4 h-4 rounded grid place-items-center text-[10px] shrink-0 ${it.concluido ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 dark:border-slate-600'}`}>{it.concluido ? '✓' : ''}</span>
                                <span className={it.concluido ? 'line-through' : ''}>{it.titulo}</span>
                              </Link>
                            ))}
                          </div>
                          <Link href={`/app/planos/ver?id=${jornada.atual.id}`} className="inline-block mt-4 text-white text-sm font-semibold px-5 py-2.5 rounded-lg" style={{ backgroundColor: cor }}>Abrir o plano →</Link>
                        </div>
                      ) : (
                        <div className="ui-card p-6 text-sm text-slate-500">Você concluiu todas as etapas disponíveis. 🎉</div>
                      )}
                      <div className="space-y-4">
                        <div className="ui-card p-5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Você não está sozinho</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">Seu mentor acompanha cada entrega e devolve uma análise personalizada. 💬</p>
                        </div>
                        {jornada.proximaLive && (
                          <Link href="/app/agenda" className="ui-card p-5 block hover:shadow-md transition">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Próxima live</p>
                            <p className="font-semibold text-sm">{jornada.proximaLive.titulo}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{new Date(jornada.proximaLive.inicioEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ===== V1: LINHA DO TEMPO ===== */
                    <div className="mt-4 relative pl-9">
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
                      {jornada.planos.map((p) => {
                        const atual = jornada.atual?.id === p.id;
                        const dot = p.entregue ? { bg: '#10a566', c: '✓' } : atual ? { bg: cor, c: String(p.ordem) } : p.bloqueado ? { bg: 'transparent', c: '🔒' } : { bg: cor, c: String(p.ordem) };
                        const inner = (
                          <div className={`ui-card p-4 ${p.bloqueado ? 'opacity-70' : ''}`} style={atual ? { borderColor: `color-mix(in srgb, ${cor} 45%, transparent)` } : undefined}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">#{p.ordem}{p.subtitulo ? ` · ${p.subtitulo}` : ''}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pillCls(p.status)}`}>{atual ? 'você está aqui' : STATUS_LABEL[p.status]}</span>
                            </div>
                            <p className="font-semibold mt-0.5">{p.titulo}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {p.bloqueado ? `abre ${fmt(p.releasedAt)}` : `${p.concluidos}/${p.totalItens} tarefas · ${p.percentual}%${p.prazoEm ? ` · vence ${fmt(p.prazoEm)}` : ''}`}
                            </p>
                          </div>
                        );
                        return (
                          <div key={p.id} className="relative mb-3">
                            <span className="absolute left-[-36px] top-0.5 w-[26px] h-[26px] rounded-full grid place-items-center text-xs font-bold text-white border-4 border-slate-100 dark:border-slate-900" style={{ backgroundColor: dot.bg === 'transparent' ? undefined : dot.bg, color: dot.bg === 'transparent' ? 'var(--tw-prose-body)' : '#fff', ...(dot.bg === 'transparent' ? { border: '2px solid #cbd5e1' } : {}) }}>{dot.c}</span>
                            {p.bloqueado ? inner : <Link href={`/app/planos/ver?id=${p.id}`} className="block">{inner}</Link>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            {cursosSection}
            {ofertasSection}
          </>
        ) : (
          /* ===== SEM JORNADA: home clássica de cursos ===== */
          <>
            {continuar && (
              <Link href={`/app/trilhas/ver?id=${continuar.id}`} className="block rounded-2xl text-white p-7" style={{ background: `linear-gradient(to right, #0f172a, ${cor})` }}>
                <p className="text-xs uppercase tracking-wide opacity-80 mb-1">Continue de onde parou</p>
                <h2 className="text-2xl font-bold">{continuar.titulo}</h2>
                <p className="text-sm opacity-90 mt-1">{continuar.aulasConcluidas} de {continuar.totalAulas} aulas concluídas</p>
                <div className="mt-4 w-full md:w-80 bg-white/20 rounded-full h-2"><div className="h-2 rounded-full bg-white/90" style={{ width: `${continuar.percentual}%` }} /></div>
                <p className="text-xs opacity-90 mt-1">{continuar.percentual}% concluído →</p>
              </Link>
            )}
            {cursosSection}
            {ofertasSection}
          </>
        )}
      </div>

      {boasVindas && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="overflow-y-auto p-6"><div className="prose-conteudo text-slate-800 dark:text-slate-100" dangerouslySetInnerHTML={{ __html: sanitizeHtml(boasVindas) }} /></div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setBoasVindas(null)} className="text-white text-sm font-semibold px-6 py-2 rounded-lg" style={{ backgroundColor: cor }}>Começar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
