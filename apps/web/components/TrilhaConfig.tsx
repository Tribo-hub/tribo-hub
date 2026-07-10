'use client';

import { useEffect, useRef, useState } from 'react';
import { api, uploadArquivo, urlAssinada } from '../lib/api';
import { comprimirImagem } from '../lib/imagem';
import { RichTextField } from './RichTextField';

const DESC_MAX = 600;

interface TrilhaCfg {
  id: string;
  descricao: string;
  capaUrl: string | null;
  exibirComoOferta: boolean;
  ofertaTodosAlunos: boolean;
  ofertaParaTrilhas: string[] | null;
  checkoutUrl: string | null;
  whatsappUrl: string | null;
  dripBase?: string | null;
  dripInicioEm?: string | null;
  usaTurmas?: boolean;
}
interface TrilhaItem { id: string; titulo: string }
interface Turma {
  id: string;
  nome: string;
  inicioEm: string | null;
  matriculasAbremEm: string | null;
  matriculasFechamEm: string | null;
  ativa: boolean;
}

// Configurações de capa (estilo Netflix, 2:3) e de vitrine/oferta da trilha.
export function TrilhaConfig({ trilha, onSaved }: { trilha: TrilhaCfg; onSaved: () => void }) {
  const [descricao, setDescricao] = useState(trilha.descricao ?? '');
  const [capaPath, setCapaPath] = useState<string | null>(trilha.capaUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [exibir, setExibir] = useState(trilha.exibirComoOferta);
  const [todos, setTodos] = useState(trilha.ofertaTodosAlunos);
  const [alvos, setAlvos] = useState<string[]>(trilha.ofertaParaTrilhas ?? []);
  const [checkout, setCheckout] = useState(trilha.checkoutUrl ?? '');
  const [whats, setWhats] = useState(trilha.whatsappUrl ?? '');
  const [dripBase, setDripBase] = useState(trilha.dripBase === 'fixa' ? 'fixa' : 'matricula');
  const [dripInicio, setDripInicio] = useState((trilha.dripInicioEm ?? '').slice(0, 10));
  const [usaTurmas, setUsaTurmas] = useState(!!trilha.usaTurmas);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [novaTurma, setNovaTurma] = useState({ nome: '', inicioEm: '', abrem: '', fecham: '' });
  const [trilhas, setTrilhas] = useState<TrilhaItem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<TrilhaItem[]>('/painel/trilhas').then((ts) => setTrilhas(ts.filter((t) => t.id !== trilha.id))).catch(() => {});
    carregarTurmas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trilha.id]);

  function carregarTurmas() {
    api<Turma[]>(`/painel/trilhas/${trilha.id}/turmas`).then(setTurmas).catch(() => {});
  }
  async function addTurma() {
    if (!novaTurma.nome.trim() || !novaTurma.inicioEm) { alert('Informe o nome e a data de início da turma.'); return; }
    try {
      await api(`/painel/trilhas/${trilha.id}/turmas`, {
        method: 'POST',
        body: JSON.stringify({
          nome: novaTurma.nome.trim(),
          inicioEm: novaTurma.inicioEm || null,
          matriculasAbremEm: novaTurma.abrem || null,
          matriculasFechamEm: novaTurma.fecham || null,
        }),
      });
      setNovaTurma({ nome: '', inicioEm: '', abrem: '', fecham: '' });
      carregarTurmas();
    } catch { alert('Falha ao criar a turma.'); }
  }
  async function toggleTurma(t: Turma) {
    try { await api(`/painel/turmas/${t.id}`, { method: 'PATCH', body: JSON.stringify({ ativa: !t.ativa }) }); carregarTurmas(); } catch { /* ignore */ }
  }
  async function removeTurma(t: Turma) {
    if (!confirm(`Excluir a turma "${t.nome}"? Os alunos não perdem o acesso, só o vínculo com a turma.`)) return;
    try { await api(`/painel/turmas/${t.id}`, { method: 'DELETE' }); carregarTurmas(); } catch { /* ignore */ }
  }

  // Preview da capa já salva (caminho do Storage → URL assinada).
  useEffect(() => {
    let vivo = true;
    if (capaPath && !preview) {
      const fonte = capaPath.startsWith('http') ? Promise.resolve(capaPath) : urlAssinada(capaPath);
      fonte.then((u) => { if (vivo) setPreview(u); }).catch(() => {});
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capaPath]);

  async function aoSelecionarCapa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const arq = await comprimirImagem(file);
      const path = await uploadArquivo('capas', arq);
      setCapaPath(path);
      setPreview(URL.createObjectURL(arq));
    } catch {
      alert('Falha ao enviar a capa.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function toggleAlvo(id: string) {
    setAlvos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  async function salvar() {
    await api(`/painel/trilhas/${trilha.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        descricao,
        capaUrl: capaPath ?? undefined,
        exibirComoOferta: exibir,
        ofertaTodosAlunos: todos,
        ofertaParaTrilhas: alvos,
        checkoutUrl: checkout,
        whatsappUrl: whats,
        dripBase,
        dripInicioEm: dripBase === 'fixa' ? (dripInicio || null) : null,
        usaTurmas,
      }),
    });
    setSalvo(true);
    onSaved();
  }

  const inp = 'w-full ui-input';

  return (
    <div className="ui-card p-5 mb-6 space-y-5">
      <h2 className="font-semibold">Configurações da trilha</h2>

      {/* Descrição (editor de texto rico, com limite) */}
      <div>
        <p className="text-sm font-medium mb-1">Descrição</p>
        <p className="text-xs text-slate-400 mb-2">Use o editor para formatar (negrito, listas, títulos). Mantenha curta para o layout ficar melhor.</p>
        <RichTextField
          value={descricao}
          onChange={setDescricao}
          maxLength={DESC_MAX}
          alturaPreview="h-[140px]"
          placeholder="Descreva a trilha em poucas linhas"
        />
      </div>

      {/* Capa */}
      <div className="flex gap-4">
        <div className="w-24 shrink-0">
          <div className="aspect-[4/5] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 grid place-items-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="capa" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🎬</span>
            )}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Capa (estilo Netflix)</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Formato retrato <b>4:5</b> — recomendado <b>800×1000 px</b> (JPG ou PNG).
          </p>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
            className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
            {enviando ? 'Enviando...' : preview ? '🖼 Trocar capa' : '🖼 Enviar capa'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={aoSelecionarCapa} />
        </div>
      </div>

      {/* Liberação por tempo (drip) + Turmas */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
        <p className="text-sm font-medium">Liberação por tempo (drip)</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={usaTurmas} onChange={(e) => setUsaTurmas(e.target.checked)} />
          Trabalhar com <b>turmas</b> (cada turma tem sua data de início e janela de matrículas)
        </label>

        {usaTurmas ? (
          <div className="pl-1 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              O drip de cada aluno conta a partir da <b>data de início da turma dele</b>. Em um único checkout, o aluno entra
              automaticamente na turma com <b>matrículas abertas</b> no momento da compra.
            </p>

            {/* lista de turmas */}
            <div className="space-y-2">
              {turmas.length === 0 && <p className="text-xs text-slate-400">Nenhuma turma ainda.</p>}
              {turmas.map((t) => (
                <div key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 ${t.ativa ? '' : 'opacity-50'}`}>
                  <span className="font-medium">{t.nome}</span>
                  <span className="text-xs text-slate-400">início {t.inicioEm ? new Date(t.inicioEm).toLocaleDateString('pt-BR') : '—'}</span>
                  <span className="text-xs text-slate-400">
                    matrículas {t.matriculasAbremEm ? new Date(t.matriculasAbremEm).toLocaleDateString('pt-BR') : '—'} → {t.matriculasFechamEm ? new Date(t.matriculasFechamEm).toLocaleDateString('pt-BR') : '—'}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <button type="button" onClick={() => toggleTurma(t)} className="text-xs text-slate-500 hover:text-tribo-600">{t.ativa ? 'desativar' : 'ativar'}</button>
                    <button type="button" onClick={() => removeTurma(t)} className="text-xs text-rose-500">excluir</button>
                  </div>
                </div>
              ))}
            </div>

            {/* nova turma */}
            <div className="grid sm:grid-cols-4 gap-2 text-sm items-end">
              <label className="block">Nome da turma<input value={novaTurma.nome} onChange={(e) => setNovaTurma({ ...novaTurma, nome: e.target.value })} placeholder="Turma Fev/26" className={inp} /></label>
              <label className="block">Início do curso<input type="date" value={novaTurma.inicioEm} onChange={(e) => setNovaTurma({ ...novaTurma, inicioEm: e.target.value })} className={inp} /></label>
              <label className="block">Matrículas abrem<input type="date" value={novaTurma.abrem} onChange={(e) => setNovaTurma({ ...novaTurma, abrem: e.target.value })} className={inp} /></label>
              <label className="block">Matrículas fecham<input type="date" value={novaTurma.fecham} onChange={(e) => setNovaTurma({ ...novaTurma, fecham: e.target.value })} className={inp} /></label>
            </div>
            <button type="button" onClick={addTurma} className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg">+ adicionar turma</button>
          </div>
        ) : (
          <div className="pl-1 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">Para as aulas com "liberar após N dias", a contagem começa a partir de:</p>
            <select value={dripBase} onChange={(e) => setDripBase(e.target.value)} className={inp}>
              <option value="matricula">Data da matrícula de cada aluno (sempre aberto)</option>
              <option value="fixa">Data de início fixa do curso (data única)</option>
            </select>
            {dripBase === 'fixa' && (
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Data de início do curso</label>
                <input type="date" value={dripInicio} onChange={(e) => setDripInicio(e.target.value)} className={inp} />
                <p className="text-[11px] text-slate-400 mt-1">Todos os alunos seguem este calendário. Antes desta data, as aulas com drip ficam bloqueadas.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vitrine / oferta */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={exibir} onChange={(e) => setExibir(e.target.checked)} />
          Exibir esta trilha como <b>oferta</b> (trancada) para alunos de outras trilhas
        </label>

        {exibir && (
          <div className="pl-6 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
              Mostrar para <b>todos os alunos</b> da conta
            </label>

            {!todos && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Mostrar para alunos das trilhas:</p>
                <div className="flex flex-wrap gap-2">
                  {trilhas.length === 0 && <span className="text-xs text-slate-400">Nenhuma outra trilha.</span>}
                  {trilhas.map((t) => (
                    <button key={t.id} type="button" onClick={() => toggleAlvo(t.id)}
                      className={`text-xs px-2 py-1 rounded-lg border ${alvos.includes(t.id)
                        ? 'bg-tribo-600 text-white border-tribo-600'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                      {alvos.includes(t.id) ? '✓ ' : ''}{t.titulo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Link de checkout (botão Comprar)</label>
              <input value={checkout} onChange={(e) => setCheckout(e.target.value)} placeholder="https://pay.hotmart.com/..." className={inp} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">WhatsApp (link ou número)</label>
              <input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="https://wa.me/5511999999999" className={inp} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={salvar} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">
          Salvar configurações
        </button>
        {salvo && <span className="text-xs text-emerald-500">✓ salvo</span>}
      </div>
    </div>
  );
}
