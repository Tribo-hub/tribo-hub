'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clearToken, getToken, uploadArquivo, urlAssinada } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { toast } from '../../../lib/toast';

type TipoItem = 'check' | 'assistir' | 'resumo' | 'link';
interface AulaRef { id: string; titulo: string; trilhaId: string }
interface PlanoResumo { id: string; titulo: string; subtitulo: string | null; ordem: number; trilhaTitulo: string | null; agendamento?: string; totalItens: number; entregas: number }
interface Item { id: string; titulo: string; descricao: string | null; tipo: TipoItem; prazoEm: string | null; prazoDias: number | null; ordem: number; aula: AulaRef | null }
interface Aluno { id: string; nome: string; email: string; totalItens: number; concluidos: number; atrasados: number; emDia: boolean; percentual: number; entregue: boolean; entregaStatus: string | null; diasAntesDoPrazo: number | null }
interface Detalhe { id: string; titulo: string; subtitulo: string | null; descricao: string | null; capaUrl: string | null; ordem: number; prazoEm: string | null; releasedAt: string | null; agendamento: string; liberaAposDias: number | null; prazoDias: number | null; xpEntrega: number; penalizarAtraso: boolean; penalidadeAtrasoPct: number | null; analiseAtiva: boolean; trilhaId: string | null; moduloId: string | null; itens: Item[]; acompanhamento: Aluno[] }
interface Trilha { id: string; titulo: string }
interface AulaOpt { id: string; titulo: string }
interface Modulo { id: string; titulo: string; aulas: AulaOpt[] }
interface TrilhaDetalhe { modulos: Modulo[] }
interface ItemAluno { id: string; titulo: string; tipo: TipoItem; aula: AulaRef | null; prazoEm: string | null; concluido: boolean; texto: string | null; links: string[]; concluidoEm: string | null; atrasado: boolean }
interface Entrega { status: string; submittedAt: string; diasAntesDoPrazo: number | null; analiseTexto: string | null; analiseEm: string | null }
interface DetalheAluno { aluno: { id: string; nome: string; email: string }; plano: { id: string; titulo: string; analiseAtiva: boolean; prazoEm: string | null }; entrega: Entrega | null; itens: ItemAluno[] }

const TIPO_LABEL: Record<TipoItem, string> = { check: 'Check', assistir: 'Assistir aula', resumo: 'Ver aula + resumo', link: 'Entregar link' };

export default function PlanosProdutorPage() {
  const router = useRouter();
  const [planos, setPlanos] = useState<PlanoResumo[]>([]);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [sel, setSel] = useState<Detalhe | null>(null);
  const [novoPlano, setNovoPlano] = useState({ titulo: '', subtitulo: '', descricao: '', trilhaId: '', moduloId: '', agendamento: 'fixo', prazoEm: '', releasedAt: '', liberaAposDias: '0', prazoDias: '', xpEntrega: '0', penalizarAtraso: false, penalidadeAtrasoPct: '20', analiseAtiva: false });
  const [modulosNovo, setModulosNovo] = useState<Modulo[]>([]);
  const [novoItem, setNovoItem] = useState<{ titulo: string; descricao: string; tipo: TipoItem; aulaId: string; prazoEm: string; prazoDias: string }>({ titulo: '', descricao: '', tipo: 'check', aulaId: '', prazoEm: '', prazoDias: '' });
  const [aulasDoPlano, setAulasDoPlano] = useState<AulaOpt[]>([]);
  const [detAluno, setDetAluno] = useState<DetalheAluno | null>(null);
  const [analiseTexto, setAnaliseTexto] = useState('');
  const [busy, setBusy] = useState(false); // trava anti-duplo-clique
  const [confirmDlg, setConfirmDlg] = useState<{ msg: string; onOk: () => void } | null>(null);

  function pedirConfirmacao(msg: string, onOk: () => void) {
    setConfirmDlg({ msg, onOk });
  }

  // edição das configurações do plano selecionado
  const [cfg, setCfg] = useState({ titulo: '', subtitulo: '', descricao: '', prazoEm: '', releasedAt: '', agendamento: 'fixo', liberaAposDias: '0', prazoDias: '', xpEntrega: '0', penalizarAtraso: false, penalidadeAtrasoPct: '20', analiseAtiva: false });
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const [capaPath, setCapaPath] = useState<string | null>(null);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setPlanos(await api<PlanoResumo[]>('/painel/planos'));
      setTrilhas(await api<Trilha[]>('/painel/trilhas'));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  const onlyDate = (d: string | null) => (d ? d.slice(0, 10) : '');

  async function abrir(id: string) {
    const d = await api<Detalhe>(`/painel/planos/${id}`);
    setSel(d);
    setNovoItem({ titulo: '', descricao: '', tipo: 'check', aulaId: '', prazoEm: '', prazoDias: '' });
    setCfg({ titulo: d.titulo, subtitulo: d.subtitulo ?? '', descricao: d.descricao ?? '', prazoEm: onlyDate(d.prazoEm), releasedAt: onlyDate(d.releasedAt), agendamento: d.agendamento ?? 'fixo', liberaAposDias: String(d.liberaAposDias ?? 0), prazoDias: d.prazoDias != null ? String(d.prazoDias) : '', xpEntrega: String(d.xpEntrega ?? 0), penalizarAtraso: d.penalizarAtraso, penalidadeAtrasoPct: d.penalidadeAtrasoPct != null ? String(d.penalidadeAtrasoPct) : '20', analiseAtiva: d.analiseAtiva });
    setCapaPath(d.capaUrl);
    setCapaPreview(null);
    if (d.capaUrl) {
      const fonte = d.capaUrl.startsWith('http') ? Promise.resolve(d.capaUrl) : urlAssinada(d.capaUrl);
      fonte.then(setCapaPreview).catch(() => {});
    }
    if (d.trilhaId) {
      try {
        const t = await api<TrilhaDetalhe>(`/painel/trilhas/${d.trilhaId}`);
        const mods = d.moduloId ? t.modulos.filter((m) => m.id === d.moduloId) : t.modulos;
        setAulasDoPlano(mods.flatMap((m) => m.aulas.map((a) => ({ id: a.id, titulo: a.titulo }))));
      } catch { setAulasDoPlano([]); }
    } else {
      setAulasDoPlano([]);
    }
  }

  async function carregarModulos(trilhaId: string) {
    if (!trilhaId) { setModulosNovo([]); return; }
    try { setModulosNovo((await api<TrilhaDetalhe>(`/painel/trilhas/${trilhaId}`)).modulos); } catch { setModulosNovo([]); }
  }

  async function abrirAluno(usuarioId: string) {
    if (!sel) return;
    const d = await api<DetalheAluno>(`/painel/planos/${sel.id}/alunos/${usuarioId}`);
    setDetAluno(d);
    setAnaliseTexto(d.entrega?.analiseTexto ?? '');
  }

  async function criarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!novoPlano.titulo.trim() || busy) return;
    setBusy(true);
    try {
      const p = await api<{ id: string }>('/painel/planos', {
        method: 'POST',
        body: JSON.stringify({
          titulo: novoPlano.titulo,
          subtitulo: novoPlano.subtitulo || undefined,
          descricao: novoPlano.descricao || undefined,
          trilhaId: novoPlano.trilhaId || undefined,
          moduloId: novoPlano.moduloId || undefined,
          agendamento: novoPlano.agendamento,
          ...(novoPlano.agendamento === 'relativo'
            ? {
                liberaAposDias: Number(novoPlano.liberaAposDias || 0),
                ...(novoPlano.prazoDias !== '' ? { prazoDias: Number(novoPlano.prazoDias) } : {}),
              }
            : {
                prazoEm: novoPlano.prazoEm ? new Date(novoPlano.prazoEm).toISOString() : undefined,
                releasedAt: novoPlano.releasedAt ? new Date(novoPlano.releasedAt).toISOString() : undefined,
              }),
          xpEntrega: Number(novoPlano.xpEntrega || 0),
          penalizarAtraso: novoPlano.penalizarAtraso,
          ...(novoPlano.penalizarAtraso ? { penalidadeAtrasoPct: Number(novoPlano.penalidadeAtrasoPct || 0) } : {}),
          analiseAtiva: novoPlano.analiseAtiva,
        }),
      });
      setNovoPlano({ titulo: '', subtitulo: '', descricao: '', trilhaId: '', moduloId: '', agendamento: 'fixo', prazoEm: '', releasedAt: '', liberaAposDias: '0', prazoDias: '', xpEntrega: '0', penalizarAtraso: false, penalidadeAtrasoPct: '20', analiseAtiva: false });
      setModulosNovo([]);
      await carregar();
      await abrir(p.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar plano');
    } finally {
      setBusy(false);
    }
  }

  async function salvarCfg() {
    if (!sel || busy) return;
    setBusy(true);
    try {
      await api(`/painel/planos/${sel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titulo: cfg.titulo,
          subtitulo: cfg.subtitulo,
          descricao: cfg.descricao,
          capaUrl: capaPath ?? '',
          agendamento: cfg.agendamento,
          ...(cfg.agendamento === 'relativo'
            ? {
                liberaAposDias: Number(cfg.liberaAposDias || 0),
                ...(cfg.prazoDias !== '' ? { prazoDias: Number(cfg.prazoDias) } : {}),
              }
            : {
                prazoEm: cfg.prazoEm ? new Date(cfg.prazoEm).toISOString() : '',
                releasedAt: cfg.releasedAt ? new Date(cfg.releasedAt).toISOString() : '',
              }),
          xpEntrega: Number(cfg.xpEntrega || 0),
          penalizarAtraso: cfg.penalizarAtraso,
          ...(cfg.penalizarAtraso ? { penalidadeAtrasoPct: Number(cfg.penalidadeAtrasoPct || 0) } : {}),
          analiseAtiva: cfg.analiseAtiva,
        }),
      });
      toast.success('Plano atualizado.');
      await carregar();
      await abrir(sel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar plano');
    } finally {
      setBusy(false);
    }
  }

  async function enviarCapa(file: File) {
    setEnviandoCapa(true);
    try {
      const path = await uploadArquivo('imagens', file);
      setCapaPath(path);
      setCapaPreview(URL.createObjectURL(file));
      toast.success('Capa enviada. Clique em “Salvar plano”.');
    } catch {
      toast.error('Falha ao enviar a capa.');
    } finally {
      setEnviandoCapa(false);
    }
  }

  function removerPlano(id: string) {
    pedirConfirmacao('Remover este plano e todos os itens?', async () => {
      try {
        await api(`/painel/planos/${id}`, { method: 'DELETE' });
        if (sel?.id === id) setSel(null);
        toast.success('Plano removido.');
        await carregar();
      } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao remover'); }
    });
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!sel || !novoItem.titulo.trim() || busy) return;
    if ((novoItem.tipo === 'assistir' || novoItem.tipo === 'resumo') && !novoItem.aulaId) { toast.error('Selecione a aula desta tarefa.'); return; }
    setBusy(true);
    try {
      await api(`/painel/planos/${sel.id}/itens`, {
        method: 'POST',
        body: JSON.stringify({
          titulo: novoItem.titulo,
          descricao: novoItem.descricao || undefined,
          tipo: novoItem.tipo,
          aulaId: novoItem.tipo === 'assistir' || novoItem.tipo === 'resumo' ? novoItem.aulaId : undefined,
          ...(sel.agendamento === 'relativo'
            ? (novoItem.prazoDias !== '' ? { prazoDias: Number(novoItem.prazoDias) } : {})
            : { prazoEm: novoItem.prazoEm ? new Date(novoItem.prazoEm).toISOString() : undefined }),
        }),
      });
      setNovoItem({ titulo: '', descricao: '', tipo: 'check', aulaId: '', prazoEm: '', prazoDias: '' });
      await abrir(sel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar tarefa');
    } finally {
      setBusy(false);
    }
  }

  function removerItem(itemId: string) {
    if (!sel) return;
    pedirConfirmacao('Remover esta tarefa do plano?', async () => {
      try {
        await api(`/painel/planos/itens/${itemId}`, { method: 'DELETE' });
        await abrir(sel.id);
      } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao remover'); }
    });
  }

  // drag & drop reorder
  function onDrop(alvoId: string) {
    if (!sel || !dragId.current || dragId.current === alvoId) return;
    const arr = [...sel.itens];
    const from = arr.findIndex((i) => i.id === dragId.current);
    const to = arr.findIndex((i) => i.id === alvoId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setSel({ ...sel, itens: arr });
    dragId.current = null;
    api(`/painel/planos/${sel.id}/itens/reordenar`, { method: 'PATCH', body: JSON.stringify({ ids: arr.map((i) => i.id) }) }).catch(() => toast.error('Erro ao reordenar'));
  }

  async function salvarAnalise() {
    if (!detAluno || !sel) return;
    if (!analiseTexto.trim()) { toast.error('Escreva a análise.'); return; }
    try {
      await api(`/painel/planos/${sel.id}/alunos/${detAluno.aluno.id}/analise`, { method: 'PATCH', body: JSON.stringify({ texto: analiseTexto }) });
      toast.success('Análise registrada.');
      await abrirAluno(detAluno.aluno.id);
      await abrir(sel.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar análise');
    }
  }

  const inp = 'w-full ui-input';
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : 'sem prazo');

  return (
    <Shell area="painel">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Planos de Ação</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Tarefas com prazo, entrega do plano e análise do mentor. Ative em “Recursos”.</p>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Lista + novo plano */}
          <div className="space-y-4">
            <section className="ui-card divide-y divide-slate-100 dark:divide-slate-700">
              {planos.length === 0 ? (
                <p className="p-4 text-center text-slate-400 text-sm">Nenhum plano ainda.</p>
              ) : planos.map((p) => (
                <button key={p.id} onClick={() => abrir(p.id)} className={`w-full text-left p-3 ${sel?.id === p.id ? 'bg-slate-50 dark:bg-slate-700/40' : ''}`}>
                  <p className="font-medium text-sm">#{p.ordem} · {p.titulo}</p>
                  <p className="text-xs text-slate-400">{p.totalItens} itens · {p.entregas} entrega(s) · {p.trilhaTitulo ?? 'todos os alunos'}</p>
                </button>
              ))}
            </section>

            <form onSubmit={criarPlano} className="ui-card p-4 space-y-2">
              <p className="font-semibold text-sm">Novo plano</p>
              <input placeholder="Título" value={novoPlano.titulo} onChange={(e) => setNovoPlano({ ...novoPlano, titulo: e.target.value })} className={inp} />
              <input placeholder="Subtítulo (ex: Ajuste de velas)" value={novoPlano.subtitulo} onChange={(e) => setNovoPlano({ ...novoPlano, subtitulo: e.target.value })} className={inp} />
              <textarea placeholder="Descrição (opcional)" value={novoPlano.descricao} onChange={(e) => setNovoPlano({ ...novoPlano, descricao: e.target.value })} rows={2} className={inp} />
              <select value={novoPlano.trilhaId} onChange={(e) => { setNovoPlano({ ...novoPlano, trilhaId: e.target.value, moduloId: '' }); carregarModulos(e.target.value); }} className={inp}>
                <option value="">Todos os alunos</option>
                {trilhas.map((t) => <option key={t.id} value={t.id}>Só alunos de: {t.titulo}</option>)}
              </select>
              {novoPlano.trilhaId && (
                <select value={novoPlano.moduloId} onChange={(e) => setNovoPlano({ ...novoPlano, moduloId: e.target.value })} className={inp}>
                  <option value="">Trilha inteira</option>
                  {modulosNovo.map((m) => <option key={m.id} value={m.id}>Módulo: {m.titulo}</option>)}
                </select>
              )}
              <select value={novoPlano.agendamento} onChange={(e) => setNovoPlano({ ...novoPlano, agendamento: e.target.value })} className={inp}>
                <option value="fixo">Datas fixas (calendário)</option>
                <option value="relativo">Dias após o início (turmas/evergreen)</option>
              </select>
              {novoPlano.agendamento === 'relativo' ? (
                <div className="flex gap-2">
                  <label className="text-xs text-slate-500 flex-1">Libera (D+)<input type="number" min={0} value={novoPlano.liberaAposDias} onChange={(e) => setNovoPlano({ ...novoPlano, liberaAposDias: e.target.value })} className={inp} /></label>
                  <label className="text-xs text-slate-500 flex-1">Entrega (D+)<input type="number" min={0} placeholder="sem prazo" value={novoPlano.prazoDias} onChange={(e) => setNovoPlano({ ...novoPlano, prazoDias: e.target.value })} className={inp} /></label>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="text-xs text-slate-500 flex-1">Liberação<input type="date" value={novoPlano.releasedAt} onChange={(e) => setNovoPlano({ ...novoPlano, releasedAt: e.target.value })} className={inp} /></label>
                  <label className="text-xs text-slate-500 flex-1">Prazo<input type="date" value={novoPlano.prazoEm} onChange={(e) => setNovoPlano({ ...novoPlano, prazoEm: e.target.value })} className={inp} /></label>
                </div>
              )}
              <label className="text-xs text-slate-500 block">XP por entregar<input type="number" min={0} value={novoPlano.xpEntrega} onChange={(e) => setNovoPlano({ ...novoPlano, xpEntrega: e.target.value })} className={inp} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={novoPlano.penalizarAtraso} onChange={(e) => setNovoPlano({ ...novoPlano, penalizarAtraso: e.target.checked })} /> Reduzir XP se entregar fora do prazo</label>
              {novoPlano.penalizarAtraso && (
                <label className="text-xs text-slate-500 block">Redução (%)<input type="number" min={0} max={100} value={novoPlano.penalidadeAtrasoPct} onChange={(e) => setNovoPlano({ ...novoPlano, penalidadeAtrasoPct: e.target.value })} className={inp} /></label>
              )}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={novoPlano.analiseAtiva} onChange={(e) => setNovoPlano({ ...novoPlano, analiseAtiva: e.target.checked })} /> Terá análise do mentor</label>
              <button disabled={busy} className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm">{busy ? 'Salvando…' : 'Criar plano'}</button>
            </form>
          </div>

          {/* Detalhe do plano selecionado */}
          {!sel ? (
            <div className="ui-card p-8 text-center text-slate-400 text-sm">Selecione um plano para ver itens e acompanhamento.</div>
          ) : (
            <div className="space-y-6">
              {/* Configurações do plano */}
              <div className="ui-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-bold text-lg">#{sel.ordem} · Configurações do plano</h2>
                  <button onClick={() => removerPlano(sel.id)} className="text-xs text-rose-500">remover plano</button>
                </div>
                <div className="grid sm:grid-cols-[120px_1fr] gap-4">
                  {/* capa */}
                  <div>
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 grid place-items-center text-slate-400 text-xs">
                      {capaPreview ? <img src={capaPreview} alt="capa" className="w-full h-full object-cover" /> : 'sem capa'}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && enviarCapa(e.target.files[0])} />
                    <button onClick={() => fileRef.current?.click()} disabled={enviandoCapa} className="mt-2 w-full text-xs border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                      {enviandoCapa ? 'Enviando...' : capaPreview ? '🖼 Trocar capa' : '🖼 Enviar capa'}
                    </button>
                    <p className="text-[11px] text-slate-400 mt-1 text-center">Formato retrato <b>2:3</b> — recomendado <b>800×1200 px</b> (JPG ou PNG).</p>
                  </div>
                  <div className="space-y-2">
                    <input placeholder="Título" value={cfg.titulo} onChange={(e) => setCfg({ ...cfg, titulo: e.target.value })} className={inp} />
                    <input placeholder="Subtítulo" value={cfg.subtitulo} onChange={(e) => setCfg({ ...cfg, subtitulo: e.target.value })} className={inp} />
                    <textarea placeholder="Descrição" value={cfg.descricao} onChange={(e) => setCfg({ ...cfg, descricao: e.target.value })} rows={2} className={inp} />
                    <select value={cfg.agendamento} onChange={(e) => setCfg({ ...cfg, agendamento: e.target.value })} className={inp}>
                      <option value="fixo">Datas fixas (calendário)</option>
                      <option value="relativo">Dias após o início (turmas/evergreen)</option>
                    </select>
                    {cfg.agendamento === 'relativo' ? (
                      <>
                        <div className="flex gap-2">
                          <label className="text-xs text-slate-500 flex-1">Libera (D+)<input type="number" min={0} value={cfg.liberaAposDias} onChange={(e) => setCfg({ ...cfg, liberaAposDias: e.target.value })} className={inp} /></label>
                          <label className="text-xs text-slate-500 flex-1">Entrega (D+)<input type="number" min={0} placeholder="sem prazo" value={cfg.prazoDias} onChange={(e) => setCfg({ ...cfg, prazoDias: e.target.value })} className={inp} /></label>
                        </div>
                        <p className="text-[11px] text-slate-400">Os dias contam a partir do início da turma do aluno (ou da matrícula, conforme a trilha).</p>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <label className="text-xs text-slate-500 flex-1">Liberação<input type="date" value={cfg.releasedAt} onChange={(e) => setCfg({ ...cfg, releasedAt: e.target.value })} className={inp} /></label>
                        <label className="text-xs text-slate-500 flex-1">Prazo<input type="date" value={cfg.prazoEm} onChange={(e) => setCfg({ ...cfg, prazoEm: e.target.value })} className={inp} /></label>
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <label className="text-xs text-slate-500 flex-1">XP por entregar<input type="number" min={0} value={cfg.xpEntrega} onChange={(e) => setCfg({ ...cfg, xpEntrega: e.target.value })} className={inp} /></label>
                      {cfg.penalizarAtraso && (
                        <label className="text-xs text-slate-500 flex-1">Redução no atraso (%)<input type="number" min={0} max={100} value={cfg.penalidadeAtrasoPct} onChange={(e) => setCfg({ ...cfg, penalidadeAtrasoPct: e.target.value })} className={inp} /></label>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.penalizarAtraso} onChange={(e) => setCfg({ ...cfg, penalizarAtraso: e.target.checked })} /> Reduzir XP se entregar fora do prazo</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.analiseAtiva} onChange={(e) => setCfg({ ...cfg, analiseAtiva: e.target.checked })} /> Terá análise do mentor</label>
                    <button onClick={salvarCfg} disabled={busy} className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg">{busy ? 'Salvando…' : 'Salvar plano'}</button>
                  </div>
                </div>

                {/* Itens (drag & drop) */}
                <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Tarefas <span className="font-normal">— arraste para reordenar</span></p>
                  <div className="space-y-1">
                    {sel.itens.length === 0 && <p className="text-xs text-slate-400">Nenhuma tarefa ainda.</p>}
                    {sel.itens.map((it) => (
                      <div key={it.id} draggable onDragStart={() => (dragId.current = it.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(it.id)}
                        className="flex items-center justify-between text-sm border border-slate-100 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 cursor-grab active:cursor-grabbing">
                        <span className="min-w-0">
                          <span className="text-slate-300 dark:text-slate-600 mr-1">⠿</span>
                          {it.ordem}. {it.titulo}
                          <span className="ml-2 text-[10px] uppercase tracking-wide bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">{TIPO_LABEL[it.tipo]}</span>
                          {it.aula && <span className="block text-xs text-slate-400">🎬 {it.aula.titulo}</span>}
                        </span>
                        <span className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                          <span>⏰ {sel.agendamento === 'relativo' ? (it.prazoDias != null ? `D+${it.prazoDias}` : 'sem prazo') : fmt(it.prazoEm)}</span>
                          <button onClick={() => removerItem(it.id)} className="text-rose-500">remover</button>
                        </span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={addItem} className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                    <p className="text-xs font-semibold text-slate-500">Nova tarefa</p>
                    <input placeholder="Título da tarefa..." value={novoItem.titulo} onChange={(e) => setNovoItem({ ...novoItem, titulo: e.target.value })} className={inp} />
                    <textarea placeholder="Descrição / instruções (texto e links — opcional)" value={novoItem.descricao} onChange={(e) => setNovoItem({ ...novoItem, descricao: e.target.value })} rows={2} className={inp} />
                    <div className="flex flex-wrap gap-2">
                      <select value={novoItem.tipo} onChange={(e) => setNovoItem({ ...novoItem, tipo: e.target.value as TipoItem, aulaId: '' })} className={`${inp} w-auto`}>
                        <option value="check">✅ Check simples</option>
                        <option value="assistir">▶️ Assistir aula</option>
                        <option value="resumo">📝 Ver aula + resumo</option>
                        <option value="link">🔗 Entregar link</option>
                      </select>
                      {(novoItem.tipo === 'assistir' || novoItem.tipo === 'resumo') && (
                        <select value={novoItem.aulaId} onChange={(e) => setNovoItem({ ...novoItem, aulaId: e.target.value })} className={`${inp} flex-1 min-w-[160px]`}>
                          <option value="">{aulasDoPlano.length ? 'Selecione a aula…' : 'Plano sem trilha — defina uma trilha'}</option>
                          {aulasDoPlano.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
                        </select>
                      )}
                      {sel.agendamento === 'relativo' ? (
                        <input type="number" min={0} placeholder="Vence D+" value={novoItem.prazoDias} onChange={(e) => setNovoItem({ ...novoItem, prazoDias: e.target.value })} className={`${inp} w-32`} />
                      ) : (
                        <input type="date" value={novoItem.prazoEm} onChange={(e) => setNovoItem({ ...novoItem, prazoEm: e.target.value })} className={`${inp} w-40`} />
                      )}
                      <button disabled={busy} className="bg-slate-700 dark:bg-slate-600 disabled:opacity-60 text-white text-sm px-4 rounded-lg">{busy ? '...' : '+ Item'}</button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Acompanhamento */}
              <div className="ui-card overflow-hidden">
                <p className="px-5 py-3 font-semibold border-b border-slate-100 dark:border-slate-700">Acompanhamento dos alunos <span className="text-xs font-normal text-slate-400">— clique em um aluno para ver entregas e análise</span></p>
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
                    <tr><th className="px-4 py-2 font-medium">Aluno</th><th className="px-4 py-2 font-medium">Progresso</th><th className="px-4 py-2 font-medium">Atrasados</th><th className="px-4 py-2 font-medium">Entrega</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sel.acompanhamento.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Nenhum aluno na audiência deste plano.</td></tr>
                    ) : sel.acompanhamento.map((a) => (
                      <tr key={a.id} onClick={() => abrirAluno(a.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="px-4 py-3">{a.nome}<br /><span className="text-xs text-slate-400">{a.email}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-tribo-600" style={{ width: `${a.percentual}%` }} /></div>
                            <span className="text-xs text-slate-400">{a.concluidos}/{a.totalItens}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{a.atrasados > 0 ? <span className="text-rose-500 font-medium">{a.atrasados}</span> : '0'}</td>
                        <td className="px-4 py-3">
                          {a.entregue ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${a.entregaStatus === 'reviewed' ? 'bg-tribo-100 text-tribo-700 dark:bg-tribo-900/40 dark:text-tribo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                              {a.entregaStatus === 'reviewed' ? 'analisado' : 'entregue'}
                            </span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: confirmação (evita confirm() nativo, que trava sob automação) */}
      {confirmDlg && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmDlg(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-sm shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-slate-800 dark:text-slate-100">{confirmDlg.msg}</p>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setConfirmDlg(null)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2">Cancelar</button>
              <button onClick={() => { const fn = confirmDlg.onOk; setConfirmDlg(null); fn(); }} className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: detalhe do aluno */}
      {detAluno && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetAluno(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{detAluno.aluno.nome}</p>
                <p className="text-xs text-slate-400">{detAluno.aluno.email}</p>
              </div>
              <button onClick={() => setDetAluno(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {detAluno.entrega && (
                <div className="text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-2 text-emerald-800 dark:text-emerald-300">
                  Entregue em {new Date(detAluno.entrega.submittedAt).toLocaleDateString('pt-BR')}
                  {detAluno.entrega.diasAntesDoPrazo != null && (detAluno.entrega.diasAntesDoPrazo >= 0 ? ` · ${detAluno.entrega.diasAntesDoPrazo} dia(s) de antecedência` : ` · ${Math.abs(detAluno.entrega.diasAntesDoPrazo)} dia(s) de atraso`)}
                </div>
              )}
              {detAluno.itens.map((it) => (
                <div key={it.id} className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className={`mt-0.5 text-lg ${it.concluido ? 'text-emerald-500' : it.atrasado ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'}`}>{it.concluido ? '✓' : it.atrasado ? '⚠' : '○'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${it.concluido ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{it.titulo} <span className="text-[10px] uppercase tracking-wide text-slate-400">· {TIPO_LABEL[it.tipo]}</span></p>
                    {it.aula && <p className="text-xs text-slate-400">🎬 {it.aula.titulo}</p>}
                    {it.tipo === 'resumo' && it.texto && <div className="mt-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{it.texto}</div>}
                    {it.tipo === 'link' && it.links.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {it.links.map((l, idx) => <li key={idx}><a href={l} target="_blank" rel="noreferrer" className="text-xs text-tribo-600 dark:text-tribo-400 break-all hover:underline">🔗 {l}</a></li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}

              {/* análise do mentor */}
              {detAluno.plano.analiseAtiva && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <p className="text-sm font-semibold mb-1">Análise do mentor</p>
                  {!detAluno.entrega ? (
                    <p className="text-xs text-slate-400">Disponível após o aluno entregar o plano.</p>
                  ) : (
                    <>
                      <textarea value={analiseTexto} onChange={(e) => setAnaliseTexto(e.target.value)} rows={4} placeholder="Escreva a sua análise para o aluno..." className="w-full ui-input" />
                      <button onClick={salvarAnalise} className="mt-1 bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">{detAluno.entrega.analiseTexto ? 'Atualizar análise' : 'Enviar análise'}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
