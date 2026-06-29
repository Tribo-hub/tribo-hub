'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { CopyButton } from './CopyButton';

interface Nota { id: string; texto: string; createdAt: string }
interface PlanoCat { id: string; nome: string; tipoConta: string; valorBase: string; ativo: boolean }
interface ParceiroOpt { id: string; nome: string; codigo: string; ativo: boolean }

// Bloco financeiro do detalhe da conta (Super Admin): plano do catálogo, trial, desconto, cobrança avulsa e notas.
export function ContaFinanceiro({ contaId, onChanged }: { contaId: string; onChanged?: () => void }) {
  const [desc, setDesc] = useState({ tipo: 'percentual', valor: '', ate: '', motivo: '' });
  const [avulsa, setAvulsa] = useState({ valor: '', observacao: '' });
  const [pix, setPix] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [novaNota, setNovaNota] = useState('');
  const [catalogo, setCatalogo] = useState<PlanoCat[]>([]);
  const [planoSel, setPlanoSel] = useState('');
  const [trialDias, setTrialDias] = useState('');
  const [parceiros, setParceiros] = useState<ParceiroOpt[]>([]);
  const [parceiroSel, setParceiroSel] = useState('');

  const carregarNotas = useCallback(async () => {
    try { setNotas(await api<Nota[]>(`/admin/contas/${contaId}/notas`)); } catch { /* ignore */ }
  }, [contaId]);

  useEffect(() => {
    if (!contaId) return;
    carregarNotas();
    api<PlanoCat[]>('/admin/planos-catalogo').then((ps) => setCatalogo(ps.filter((p) => p.ativo))).catch(() => {});
    api<ParceiroOpt[]>('/admin/parceiros').then((ps) => setParceiros(ps.filter((p) => p.ativo))).catch(() => {});
    api<{ referidoPorParceiroId: string | null } | null>(`/admin/contas/${contaId}/parceiro`).then((r) => setParceiroSel(r?.referidoPorParceiroId ?? '')).catch(() => {});
  }, [contaId, carregarNotas]);

  async function salvarParceiro() {
    try {
      await api(`/admin/contas/${contaId}/parceiro`, { method: 'POST', body: JSON.stringify({ parceiroId: parceiroSel || null }) });
      toast.success('Parceiro indicador atualizado.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  async function aplicarPlano() {
    if (!planoSel) { toast.error('Selecione um plano.'); return; }
    try {
      await api(`/admin/contas/${contaId}/aplicar-plano`, { method: 'POST', body: JSON.stringify({ planoCatalogoId: planoSel }) });
      toast.success('Plano aplicado à assinatura.');
      onChanged?.();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao aplicar plano'); }
  }
  async function aplicarTrial(dias: number) {
    try {
      await api(`/admin/contas/${contaId}/trial`, { method: 'POST', body: JSON.stringify({ dias }) });
      toast.success(dias > 0 ? `Trial de ${dias} dias aplicado.` : 'Trial removido.');
      setTrialDias('');
      onChanged?.();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  async function salvarDesconto(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.valor) { toast.error('Informe o valor do desconto.'); return; }
    try {
      await api(`/admin/contas/${contaId}/desconto`, {
        method: 'POST',
        body: JSON.stringify({ tipo: desc.tipo, valor: Number(desc.valor), ate: desc.ate || null, motivo: desc.motivo || undefined }),
      });
      toast.success('Desconto aplicado (vale a partir da próxima fatura).');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao aplicar desconto'); }
  }
  async function removerDesconto() {
    if (!confirm('Remover o desconto desta conta?')) return;
    try { await api(`/admin/contas/${contaId}/desconto`, { method: 'DELETE' }); toast.success('Desconto removido.'); setDesc({ tipo: 'percentual', valor: '', ate: '', motivo: '' }); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  async function gerarAvulsa(e: React.FormEvent) {
    e.preventDefault();
    if (!avulsa.valor) { toast.error('Informe o valor.'); return; }
    try {
      const r = await api<{ pix: { pixCopiaECola?: string } | null }>(`/admin/contas/${contaId}/cobranca-avulsa`, {
        method: 'POST',
        body: JSON.stringify({ valor: Number(avulsa.valor), observacao: avulsa.observacao || undefined }),
      });
      setPix(r.pix?.pixCopiaECola ?? null);
      toast.success('Cobrança avulsa criada.');
      setAvulsa({ valor: '', observacao: '' });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao gerar cobrança'); }
  }

  async function adicionarNota(e: React.FormEvent) {
    e.preventDefault();
    if (!novaNota.trim()) return;
    try { await api(`/admin/contas/${contaId}/notas`, { method: 'POST', body: JSON.stringify({ texto: novaNota }) }); setNovaNota(''); await carregarNotas(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }
  async function removerNota(id: string) {
    try { await api(`/admin/notas/${id}`, { method: 'DELETE' }); await carregarNotas(); } catch { /* ignore */ }
  }

  const inp = 'w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm';

  return (
    <>
      {/* Plano do catálogo + Trial */}
      <div className="ui-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Plano do catálogo</h2>
          <p className="text-xs text-slate-400 mb-2">Aplica os valores de um plano padrão à assinatura desta conta.</p>
          <div className="flex flex-wrap gap-2">
            <select value={planoSel} onChange={(e) => setPlanoSel(e.target.value)} className="flex-1 min-w-[180px] border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione um plano…</option>
              {catalogo.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.tipoConta}) · R$ {Number(p.valorBase).toFixed(2)}</option>)}
            </select>
            <button type="button" onClick={aplicarPlano} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Aplicar plano</button>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
          <h2 className="font-semibold">Trial (cortesia)</h2>
          <p className="text-xs text-slate-400 mb-2">Durante o trial a conta não é cobrada nem suspensa.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min={1} value={trialDias} onChange={(e) => setTrialDias(e.target.value)} placeholder="dias" className="w-28 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm" />
            <button type="button" onClick={() => aplicarTrial(Number(trialDias))} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Aplicar trial</button>
            <button type="button" onClick={() => aplicarTrial(0)} className="text-sm text-rose-500">Remover trial</button>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
          <h2 className="font-semibold">Parceiro indicador</h2>
          <p className="text-xs text-slate-400 mb-2">Define quem indicou esta conta (gera comissão nas faturas pagas).</p>
          <div className="flex flex-wrap gap-2">
            <select value={parceiroSel} onChange={(e) => setParceiroSel(e.target.value)} className="flex-1 min-w-[180px] border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm">
              <option value="">Sem parceiro</option>
              {parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.codigo})</option>)}
            </select>
            <button type="button" onClick={salvarParceiro} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Salvar</button>
          </div>
        </div>
      </div>

      {/* Desconto */}
      <form onSubmit={salvarDesconto} className="ui-card p-5 space-y-3">
        <h2 className="font-semibold">Desconto recorrente</h2>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <label className="block">Tipo
            <select value={desc.tipo} onChange={(e) => setDesc({ ...desc, tipo: e.target.value })} className={inp}>
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Fixo (R$)</option>
            </select>
          </label>
          <label className="block">Valor
            <input type="number" step="0.01" value={desc.valor} onChange={(e) => setDesc({ ...desc, valor: e.target.value })} className={inp} />
          </label>
          <label className="block">Até (opcional)
            <input type="date" value={desc.ate} onChange={(e) => setDesc({ ...desc, ate: e.target.value })} className={inp} />
          </label>
          <label className="block">Motivo (opcional)
            <input value={desc.motivo} onChange={(e) => setDesc({ ...desc, motivo: e.target.value })} className={inp} />
          </label>
        </div>
        <div className="flex gap-3">
          <button className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Aplicar desconto</button>
          <button type="button" onClick={removerDesconto} className="text-sm text-rose-500">Remover desconto</button>
        </div>
        <p className="text-xs text-slate-400">O desconto é aplicado no fechamento das próximas faturas (faturas já pagas não mudam).</p>
      </form>

      {/* Cobrança avulsa */}
      <form onSubmit={gerarAvulsa} className="ui-card p-5 space-y-3">
        <h2 className="font-semibold">Cobrança avulsa</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <label className="block">Valor (R$)
            <input type="number" step="0.01" value={avulsa.valor} onChange={(e) => setAvulsa({ ...avulsa, valor: e.target.value })} className={inp} />
          </label>
          <label className="block">Observação (opcional)
            <input value={avulsa.observacao} onChange={(e) => setAvulsa({ ...avulsa, observacao: e.target.value })} className={inp} />
          </label>
        </div>
        <button className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Gerar cobrança Pix</button>
        {pix && (
          <div className="text-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Pix copia-e-cola:</p>
            <code className="block bg-white dark:bg-slate-800 border rounded p-2 break-all text-xs">{pix}</code>
            <div className="mt-2"><CopyButton texto={pix} label="Copiar Pix" /></div>
          </div>
        )}
      </form>

      {/* Notas internas */}
      <div className="ui-card p-5 space-y-3">
        <h2 className="font-semibold">Notas internas <span className="text-xs font-normal text-slate-400">(só o Super Admin vê)</span></h2>
        <form onSubmit={adicionarNota} className="flex gap-2">
          <input value={novaNota} onChange={(e) => setNovaNota(e.target.value)} placeholder="Adicionar nota..." className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm" />
          <button className="bg-slate-700 dark:bg-slate-600 text-white text-sm px-4 rounded-lg">Adicionar</button>
        </form>
        <ul className="space-y-2">
          {notas.length === 0 ? <li className="text-sm text-slate-400">Nenhuma nota.</li> : notas.map((n) => (
            <li key={n.id} className="text-sm flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-2">
              <span><span className="text-slate-700 dark:text-slate-200">{n.texto}</span><br /><span className="text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString('pt-BR')}</span></span>
              <button onClick={() => removerNota(n.id)} className="text-rose-500 text-xs shrink-0">remover</button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
