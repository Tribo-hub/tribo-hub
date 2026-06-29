'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';
import { Shell } from '../../../../components/Shell';
import { CopyButton } from '../../../../components/CopyButton';
import { toast } from '../../../../lib/toast';

interface Detalhe {
  parceiro: { id: string; codigo: string; nome: string; email: string | null; documento: string | null; chavePix: string | null; comissaoPercentual: string; tiers: { minContas: number; percentual: number }[] | null; ativo: boolean; observacao: string | null };
  contas: { id: string; nome: string; tipoConta: string; ativo: boolean; referidoEm: string | null }[];
  comissoes: { id: string; competencia: string; baseValor: string; percentual: string; valor: string; status: string; disponivelEm: string; pagaEm: string | null }[];
  totais: { pendente: number; disponivel: number; paga: number };
}

const STATUS: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  disponivel: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  paga: 'bg-slate-200 text-slate-600 dark:bg-slate-700',
  revertida: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export default function ParceiroDetalhePage() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [d, setD] = useState<Detalhe | null>(null);
  const [refUrl, setRefUrl] = useState('');

  const carregar = useCallback(async (pid: string) => {
    try { setD(await api<Detalhe>(`/admin/parceiros/${pid}`)); }
    catch (err) { if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); } }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    const pid = new URLSearchParams(window.location.search).get('id') || '';
    if (!pid) { router.replace('/admin/parceiros'); return; }
    setId(pid);
    carregar(pid);
  }, [router, carregar]);

  useEffect(() => {
    if (d?.parceiro.codigo) setRefUrl(`${window.location.origin}/criar-conta?ref=${d.parceiro.codigo}`);
  }, [d?.parceiro.codigo]);

  async function pagar(comissaoId: string) {
    try { await api(`/admin/comissoes/${comissaoId}/pagar`, { method: 'POST' }); toast.success('Comissão paga.'); await carregar(id); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }
  async function pagarTodas() {
    if (!confirm('Marcar todas as comissões disponíveis como pagas?')) return;
    try { const r = await api<{ pagas: number }>(`/admin/parceiros/${id}/pagar-comissoes`, { method: 'POST' }); toast.success(`${r.pagas} comissão(ões) paga(s).`); await carregar(id); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  const reais = (v: unknown) => `R$ ${Number(v).toFixed(2)}`;

  if (!d) return <Shell area="admin"><div className="p-6 text-slate-400">Carregando…</div></Shell>;
  const p = d.parceiro;

  return (
    <Shell area="admin">
      <div className="p-6 max-w-5xl space-y-6">
        <Link href="/admin/parceiros" className="text-sm text-slate-500 hover:text-tribo-600">← Parceiros</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{p.nome}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Código <span className="font-mono">{p.codigo}</span> · comissão base {Number(p.comissaoPercentual)}% {p.ativo ? '' : '· inativo'}</p>
          </div>
        </div>

        {/* Link de indicação */}
        <div className="ui-card p-5 space-y-2">
          <h2 className="font-semibold">Link de indicação</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-[240px] bg-slate-50 dark:bg-slate-900/40 border rounded p-2 break-all text-xs">{refUrl}</code>
            {refUrl && <CopyButton texto={refUrl} label="Copiar link" />}
          </div>
          {p.tiers && p.tiers.length > 0 && (
            <p className="text-xs text-slate-400">Faixas: {p.tiers.map((t) => `${t.percentual}% a partir de ${t.minContas} contas`).join(' · ')}</p>
          )}
          {p.chavePix && <p className="text-xs text-slate-400">Pix para repasse: <span className="font-mono">{p.chavePix}</span></p>}
        </div>

        {/* Totais */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="ui-card p-4"><p className="text-xs text-slate-400">Pendente (carência)</p><p className="text-xl font-bold text-amber-600">{reais(d.totais.pendente)}</p></div>
          <div className="ui-card p-4"><p className="text-xs text-slate-400">Disponível p/ pagar</p><p className="text-xl font-bold text-emerald-600">{reais(d.totais.disponivel)}</p></div>
          <div className="ui-card p-4"><p className="text-xs text-slate-400">Já pago</p><p className="text-xl font-bold text-slate-500">{reais(d.totais.paga)}</p></div>
        </div>

        {/* Comissões */}
        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold">Comissões</h2>
            <button onClick={pagarTodas} disabled={d.totais.disponivel <= 0} className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Pagar disponíveis</button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
              <tr><th className="px-4 py-2 font-medium">Competência</th><th className="px-4 py-2 font-medium">Base</th><th className="px-4 py-2 font-medium">%</th><th className="px-4 py-2 font-medium">Comissão</th><th className="px-4 py-2 font-medium">Disponível em</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {d.comissoes.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Nenhuma comissão ainda.</td></tr>
              ) : d.comissoes.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">{c.competencia}</td>
                  <td className="px-4 py-3">{reais(c.baseValor)}</td>
                  <td className="px-4 py-3">{Number(c.percentual)}%</td>
                  <td className="px-4 py-3 font-medium">{reais(c.valor)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(c.disponivelEm).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[c.status] ?? ''}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-right">{c.status === 'disponivel' && <button onClick={() => pagar(c.id)} className="text-tribo-600 text-xs hover:underline">pagar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Contas indicadas */}
        <div className="ui-card overflow-hidden">
          <h2 className="font-semibold p-4 border-b border-slate-100 dark:border-slate-700">Contas indicadas ({d.contas.length})</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {d.contas.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-slate-400">Nenhuma conta indicada.</td></tr>
              ) : d.contas.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3"><Link href={`/admin/contas/detalhe?id=${c.id}`} className="text-tribo-600 hover:underline">{c.nome}</Link></td>
                  <td className="px-4 py-3 text-slate-400">{c.tipoConta}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{c.referidoEm ? new Date(c.referidoEm).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3">{c.ativo ? <span className="text-emerald-600 text-xs">ativa</span> : <span className="text-slate-400 text-xs">inativa</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
