'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';
import { toast } from '../../../../lib/toast';

type TipoItem = 'check' | 'assistir' | 'resumo' | 'link';
interface AulaRef { id: string; titulo: string; trilhaId: string }
interface Item { id: string; titulo: string; descricao: string | null; tipo: TipoItem; prazoEm: string | null; concluido: boolean; texto: string; links: string[]; aula: AulaRef | null }
interface Entrega { status: string; submittedAt: string; diasAntesDoPrazo: number | null; analiseTexto: string | null }
interface Detalhe {
  id: string; titulo: string; subtitulo: string | null; descricao: string | null; ordem: number;
  prazoEm: string | null; releasedAt: string | null; bloqueado: boolean; analiseAtiva: boolean;
  totalItens: number; concluidos: number; percentual: number; podeEntregar: boolean;
  entrega: Entrega | null; itens: Item[];
}
interface Me { conta?: { corPrimaria: string | null } }

const DIA = 86_400_000;
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
const TIPO_ICON: Record<TipoItem, string> = { check: '', assistir: '▶️', resumo: '📝', link: '🔗' };

// Converte texto com URLs em nós com links clicáveis (descrição = texto + links).
function comLinks(txt: string) {
  const re = /(https?:\/\/[^\s]+)/g;
  return txt.split(re).map((parte, i) =>
    re.test(parte) ? (
      <a key={i} href={parte} target="_blank" rel="noreferrer" className="text-tribo-600 dark:text-tribo-400 underline break-all">{parte}</a>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}

export default function PlanoDetalhePage() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [d, setD] = useState<Detalhe | null>(null);
  const [cor, setCor] = useState('#7c3aed');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<Item | null>(null);
  const [resumo, setResumo] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [entregando, setEntregando] = useState(false);

  const carregar = useCallback(async (planoId: string) => {
    try {
      const [det, me] = await Promise.all([api<Detalhe>(`/app/planos/${planoId}`), api<Me>('/me')]);
      setD(det);
      setCor(me.conta?.corPrimaria || '#7c3aed');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); return; }
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    const pid = new URLSearchParams(window.location.search).get('id') ?? '';
    setId(pid);
    if (pid) carregar(pid);
  }, [router, carregar]);

  function abrirItem(it: Item) {
    setAberto(it);
    setResumo(it.texto || '');
    setLinks(it.links.length ? it.links : ['']);
  }

  const readonly = !!d?.entrega || !!d?.bloqueado;

  async function patch(itemId: string, body: object) {
    await api(`/app/planos/itens/${itemId}`, { method: 'PATCH', body: JSON.stringify(body) });
    await carregar(id);
  }
  async function marcarCheck(it: Item) {
    try { await patch(it.id, { concluido: !it.concluido }); setAberto(null); } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); }
  }
  async function enviarResumo(it: Item) {
    if (!resumo.trim()) { toast.error('Escreva o resumo.'); return; }
    try { await patch(it.id, { texto: resumo }); toast.success('Resumo enviado.'); setAberto(null); } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); }
  }
  async function enviarLinks(it: Item) {
    const limpos = links.map((l) => l.trim()).filter(Boolean);
    if (!limpos.length) { toast.error('Adicione ao menos um link.'); return; }
    try { await patch(it.id, { links: limpos }); toast.success('Entrega enviada.'); setAberto(null); } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); }
  }
  async function entregarPlano() {
    if (!d) return;
    if (!confirm('Entregar o plano? Após entregar, as tarefas ficam travadas.')) return;
    setEntregando(true);
    try {
      await api(`/app/planos/${d.id}/entregar`, { method: 'POST' });
      toast.success('Plano entregue! 🎉');
      await carregar(id);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao entregar'); }
    finally { setEntregando(false); }
  }

  if (erro) return <main><div className="max-w-3xl mx-auto px-5 py-10 text-slate-500">{erro} · <Link href="/app/planos" className="underline">voltar</Link></div></main>;
  if (!d) return <main><div className="max-w-3xl mx-auto px-5 py-10 text-slate-500">Carregando...</div></main>;

  const linkAula = (a: AulaRef) => `/app/player?id=${a.trilhaId}&aula=${a.id}`;
  const prazoTxt = (() => {
    if (!d.prazoEm) return null;
    const dias = Math.ceil((new Date(d.prazoEm).getTime() - Date.now()) / DIA);
    if (d.entrega) return null;
    if (dias < 0) return { t: `${Math.abs(dias)} dia(s) de atraso`, alerta: true };
    if (dias === 0) return { t: 'Vence hoje', alerta: true };
    return { t: `Faltam ${dias} dias`, alerta: false };
  })();

  return (
    <main>
      <div className="max-w-3xl mx-auto px-5 py-8">
        <Link href="/app/planos" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">← Planos de ação</Link>

        {/* HERO */}
        <div className="mt-3 rounded-2xl text-white p-6" style={{ background: `linear-gradient(to right, #0f172a, ${cor})` }}>
          <p className="text-xs uppercase tracking-wide opacity-80">Plano #{d.ordem}{d.subtitulo ? ` · ${d.subtitulo}` : ''}</p>
          <h1 className="text-2xl font-bold mt-1">{d.titulo}</h1>
          {d.descricao && <p className="text-sm opacity-90 mt-1 whitespace-pre-wrap">{comLinks(d.descricao)}</p>}
          <div className="mt-4 w-full md:w-96 bg-white/20 rounded-full h-2"><div className="h-2 rounded-full bg-white/90" style={{ width: `${d.percentual}%` }} /></div>
          <p className="text-xs opacity-90 mt-1">{d.concluidos} de {d.totalItens} concluídas · {d.percentual}%</p>
        </div>

        {/* metadados */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="ui-card p-4"><p className="text-xs text-slate-400">Prazo de entrega</p><p className="font-semibold">{fmt(d.prazoEm) || 'sem prazo'}</p>{prazoTxt && <p className={`text-xs mt-0.5 ${prazoTxt.alerta ? 'text-rose-500' : 'text-slate-400'}`}>⏰ {prazoTxt.t}</p>}</div>
          <div className="ui-card p-4"><p className="text-xs text-slate-400">Liberado em</p><p className="font-semibold">{fmt(d.releasedAt) || '—'}</p></div>
        </div>

        {/* entregue / análise */}
        {d.entrega && (
          <div className="ui-card p-4 mt-4 border-l-4" style={{ borderColor: cor }}>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">✓ Plano entregue em {fmt(d.entrega.submittedAt)}
              {d.entrega.diasAntesDoPrazo != null && (d.entrega.diasAntesDoPrazo >= 0 ? ` (${d.entrega.diasAntesDoPrazo} dia(s) de antecedência)` : ` (${Math.abs(d.entrega.diasAntesDoPrazo)} dia(s) de atraso)`)}
            </p>
            {d.analiseAtiva && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-slate-500">Análise do mentor</p>
                {d.entrega.analiseTexto ? (
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap mt-1">{comLinks(d.entrega.analiseTexto)}</p>
                ) : (
                  <p className="text-sm text-slate-400 mt-1">Aguardando a análise do mentor.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* lista de tarefas */}
        <h2 className="font-bold mt-6 mb-2">Entregáveis</h2>
        <div className="space-y-2">
          {d.itens.map((it, i) => {
            const atrasado = !it.concluido && it.prazoEm && new Date(it.prazoEm).getTime() < Date.now();
            return (
              <button key={it.id} onClick={() => abrirItem(it)} className="w-full text-left ui-card p-3 flex items-center gap-3 hover:shadow-md transition">
                <span className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm ${it.concluido ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{it.concluido ? '✓' : i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{TIPO_ICON[it.tipo] ? TIPO_ICON[it.tipo] + ' ' : ''}{it.titulo}</span>
                  {it.descricao && <span className="text-xs text-slate-400 block truncate">{it.descricao}</span>}
                </span>
                {it.prazoEm && <span className={`text-xs shrink-0 ${atrasado ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>{fmt(it.prazoEm)}</span>}
              </button>
            );
          })}
        </div>

        {/* entregar plano */}
        <div className="mt-6 ui-card p-5 text-center">
          {d.entrega ? (
            <p className="text-sm text-slate-500">Plano já entregue. As tarefas estão travadas.</p>
          ) : d.bloqueado ? (
            <p className="text-sm text-slate-500">🔒 Plano disponível a partir de {fmt(d.releasedAt)}.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-3">{d.podeEntregar ? 'Tudo pronto! Você já pode entregar o plano.' : 'Finalize todas as tarefas para entregar o plano.'}</p>
              <button onClick={entregarPlano} disabled={!d.podeEntregar || entregando} style={d.podeEntregar ? { backgroundColor: cor } : undefined}
                className={`px-6 py-2.5 rounded-lg text-white font-semibold text-sm ${d.podeEntregar ? 'hover:opacity-90' : 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed'}`}>
                {entregando ? 'Entregando...' : `Entregar plano #${d.ordem}`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* MODAL DE DETALHE / SUBMISSÃO DA TAREFA */}
      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAberto(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{TIPO_ICON[aberto.tipo] ? TIPO_ICON[aberto.tipo] + ' ' : ''}{aberto.titulo}</p>
                <p className="text-xs mt-0.5">
                  <span className={`px-2 py-0.5 rounded-full ${aberto.concluido ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>{aberto.concluido ? 'Concluído' : 'Pendente'}</span>
                  {aberto.prazoEm && <span className="text-slate-400 ml-2">Prazo: {fmt(aberto.prazoEm)}</span>}
                </p>
              </div>
              <button onClick={() => setAberto(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {aberto.descricao && <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comLinks(aberto.descricao)}</div>}
              {aberto.aula && <Link href={linkAula(aberto.aula)} className="inline-block text-sm font-medium" style={{ color: cor }}>▶️ Assistir: {aberto.aula.titulo} →</Link>}

              {/* submissão por tipo */}
              {readonly ? (
                <p className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">{d.entrega ? 'Plano entregue — tarefa travada.' : 'Plano ainda não liberado.'}</p>
              ) : (
                <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                  {aberto.tipo === 'assistir' && (
                    <p className="text-xs text-slate-500">Esta tarefa conclui automaticamente quando você assistir a aula. {aberto.concluido && <span className="text-emerald-500 font-medium">Aula concluída ✓</span>}</p>
                  )}
                  {aberto.tipo === 'check' && (
                    <button onClick={() => marcarCheck(aberto)} style={!aberto.concluido ? { backgroundColor: cor } : undefined}
                      className={`text-sm font-semibold px-4 py-2 rounded-lg ${aberto.concluido ? 'border border-slate-300 dark:border-slate-600' : 'text-white'}`}>
                      {aberto.concluido ? 'Desmarcar' : 'Confirmar conclusão ✓'}
                    </button>
                  )}
                  {aberto.tipo === 'resumo' && (
                    <div>
                      <textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={4} maxLength={5000} placeholder="Escreva o seu resumo da aula..." className="w-full ui-input" />
                      <button onClick={() => enviarResumo(aberto)} style={{ backgroundColor: cor }} className="mt-1 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90">{aberto.concluido ? 'Atualizar resumo' : 'Enviar resumo'}</button>
                    </div>
                  )}
                  {aberto.tipo === 'link' && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">Cole o(s) link(s) da entrega (ex.: pasta do Google Drive).</p>
                      {links.map((l, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input value={l} onChange={(e) => setLinks(links.map((x, k) => (k === idx ? e.target.value : x)))} placeholder="https://drive.google.com/..." className="flex-1 ui-input" />
                          {links.length > 1 && <button onClick={() => setLinks(links.filter((_, k) => k !== idx))} className="text-rose-500 px-2">×</button>}
                        </div>
                      ))}
                      <button onClick={() => setLinks([...links, ''])} className="text-xs font-medium" style={{ color: cor }}>+ Adicionar link</button>
                      <div><button onClick={() => enviarLinks(aberto)} style={{ backgroundColor: cor }} className="mt-1 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90">Enviar entrega ✓</button></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
