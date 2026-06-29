'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { toast } from '../../../lib/toast';

interface Parceiro {
  id: string;
  codigo: string;
  nome: string;
  email: string | null;
  comissaoPercentual: string;
  ativo: boolean;
  contasReferidas: number;
  comissaoPendente: number;
  comissaoDisponivel: number;
  comissaoPaga: number;
}

type Tier = { minContas: string; percentual: string };
const vazio = { nome: '', email: '', documento: '', chavePix: '', comissaoPercentual: '20', observacao: '' };

export default function ParceirosPage() {
  const router = useRouter();
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [tiers, setTiers] = useState<Tier[]>([]);

  const carregar = useCallback(async () => {
    try { setParceiros(await api<Parceiro[]>('/admin/parceiros')); }
    catch (err) { if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); } }
  }, [router]);

  useEffect(() => { if (!getToken()) { router.replace('/login'); return; } carregar(); }, [router, carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Informe o nome.'); return; }
    const tiersLimpos = tiers
      .filter((t) => t.minContas && t.percentual)
      .map((t) => ({ minContas: Number(t.minContas), percentual: Number(t.percentual) }))
      .sort((a, b) => a.minContas - b.minContas);
    try {
      await api('/admin/parceiros', {
        method: 'POST',
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim() || undefined,
          documento: form.documento.trim() || undefined,
          chavePix: form.chavePix.trim() || undefined,
          comissaoPercentual: Number(form.comissaoPercentual || 0),
          tiers: tiersLimpos.length ? tiersLimpos : undefined,
          observacao: form.observacao.trim() || undefined,
        }),
      });
      setForm({ ...vazio });
      setTiers([]);
      toast.success('Parceiro criado.');
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao criar'); }
  }

  async function alternarAtivo(p: Parceiro) {
    try {
      if (p.ativo) { await api(`/admin/parceiros/${p.id}`, { method: 'DELETE' }); }
      else { await api(`/admin/parceiros/${p.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: true }) }); }
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  const inp = 'w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm';
  const reais = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <Shell area="admin">
      <div className="p-6 max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Parceiros & afiliados</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Indicações com comissão por fatura paga (carência de 30 dias). Compartilhe o link <code>?ref=CÓDIGO</code>.</p>
        </div>

        <form onSubmit={criar} className="ui-card p-5 space-y-3">
          <h2 className="font-semibold">Novo parceiro</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <label className="block">Nome<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inp} /></label>
            <label className="block">E-mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></label>
            <label className="block">Documento (CPF/CNPJ)<input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} className={inp} /></label>
            <label className="block">Chave Pix<input value={form.chavePix} onChange={(e) => setForm({ ...form, chavePix: e.target.value })} className={inp} /></label>
            <label className="block">Comissão base (%)<input type="number" step="0.01" value={form.comissaoPercentual} onChange={(e) => setForm({ ...form, comissaoPercentual: e.target.value })} className={inp} /></label>
            <label className="block">Observação<input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className={inp} /></label>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Faixas progressivas <span className="text-xs font-normal text-slate-400">(opcional — % maior conforme nº de contas ativas)</span></p>
              <button type="button" onClick={() => setTiers([...tiers, { minContas: '', percentual: '' }])} className="text-xs text-tribo-600">+ adicionar faixa</button>
            </div>
            {tiers.map((t, i) => (
              <div key={i} className="flex gap-2 items-center mt-2 text-sm">
                <span className="text-slate-400">a partir de</span>
                <input type="number" value={t.minContas} onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, minContas: e.target.value } : x))} placeholder="contas" className="w-24 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1" />
                <span className="text-slate-400">contas →</span>
                <input type="number" step="0.01" value={t.percentual} onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, percentual: e.target.value } : x))} placeholder="%" className="w-24 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1" />
                <button type="button" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="text-rose-500 text-xs">remover</button>
              </div>
            ))}
          </div>

          <button className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Criar parceiro</button>
        </form>

        <div className="ui-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
              <tr><th className="px-4 py-2 font-medium">Parceiro</th><th className="px-4 py-2 font-medium">Código</th><th className="px-4 py-2 font-medium">%</th><th className="px-4 py-2 font-medium">Contas</th><th className="px-4 py-2 font-medium">Pendente</th><th className="px-4 py-2 font-medium">Disponível</th><th className="px-4 py-2 font-medium">Paga</th><th className="px-4 py-2 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {parceiros.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Nenhum parceiro.</td></tr>
              ) : parceiros.map((p) => (
                <tr key={p.id} className={p.ativo ? '' : 'opacity-50'}>
                  <td className="px-4 py-3"><Link href={`/admin/parceiros/detalhe?id=${p.id}`} className="text-tribo-600 hover:underline font-medium">{p.nome}</Link>{p.email && <><br /><span className="text-xs text-slate-400">{p.email}</span></>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                  <td className="px-4 py-3">{Number(p.comissaoPercentual)}%</td>
                  <td className="px-4 py-3">{p.contasReferidas}</td>
                  <td className="px-4 py-3 text-amber-600">{reais(p.comissaoPendente)}</td>
                  <td className="px-4 py-3 text-emerald-600">{reais(p.comissaoDisponivel)}</td>
                  <td className="px-4 py-3 text-slate-500">{reais(p.comissaoPaga)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => alternarAtivo(p)} className={`text-xs px-2 py-0.5 rounded-full ${p.ativo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                      {p.ativo ? 'ativo' : 'inativo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
