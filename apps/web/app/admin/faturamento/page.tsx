'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { CopyButton } from '../../../components/CopyButton';
import { Badge } from '../../../components/ui/Badge';
import { toast } from '../../../lib/toast';

interface Fatura {
  id: string;
  competencia: string;
  valorTotal: string;
  status: string;
  alunosAtivos: number | null;
  assentosUsados: number | null;
  pixCopiaECola: string | null;
  conta: { nome: string; tipoConta: string };
}
interface Lista {
  competencia: string;
  mrr: number;
  totalContas: number;
  faturas: Fatura[];
}

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FaturamentoPage() {
  const router = useRouter();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [data, setData] = useState<Lista | null>(null);
  const [pix, setPix] = useState<{ nome: string; valor: number; copia: string } | null>(null);
  const [boleto, setBoleto] = useState<{ nome: string; link?: string; linha?: string } | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async (comp: string) => {
    try {
      setData(await api<Lista>(`/admin/faturamento?competencia=${comp}`));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar(competencia);
  }, [router, carregar, competencia]);

  async function fecharMes() {
    try {
      await api('/admin/faturamento/fechar', { method: 'POST', body: JSON.stringify({ competencia }) });
      toast.success('Faturas do mês fechadas.');
      await carregar(competencia);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fechar faturas');
    }
  }

  async function cobrar(f: Fatura) {
    if (!confirm(`Gerar cobrança Pix de R$ ${Number(f.valorTotal).toFixed(2)} para "${f.conta.nome}"?`)) return;
    setProcessando(f.id);
    try {
      const r = await api<{ valor: number; pixCopiaECola: string }>(`/admin/faturamento/${f.id}/cobrar`, { method: 'POST' });
      setPix({ nome: f.conta.nome, valor: r.valor, copia: r.pixCopiaECola });
      toast.success('Cobrança Pix gerada.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao cobrar (Efí configurada?)'); }
    finally { setProcessando(null); }
  }

  async function gerarBoleto(f: Fatura) {
    const documento = prompt(`CPF ou CNPJ do pagador (boleto de R$ ${Number(f.valorTotal).toFixed(2)} — ${f.conta.nome}):`);
    if (!documento || documento.replace(/\D/g, '').length < 11) { if (documento !== null) toast.error('Documento inválido.'); return; }
    const email = prompt('E-mail do pagador:') || '';
    if (!email) { toast.error('E-mail obrigatório para o boleto.'); return; }
    setProcessando(f.id);
    try {
      const r = await api<{ link?: string; pdf?: string; linhaDigitavel?: string }>(`/admin/faturamento/${f.id}/boleto`, {
        method: 'POST',
        body: JSON.stringify({ nome: f.conta.nome, email, documento }),
      });
      setBoleto({ nome: f.conta.nome, link: r.link ?? r.pdf, linha: r.linhaDigitavel });
      toast.success('Boleto gerado.');
      await carregar(competencia);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao gerar boleto (Efí Cobranças configurada?)'); }
    finally { setProcessando(null); }
  }

  async function marcarPaga(f: Fatura) {
    if (!confirm(`Marcar a fatura de "${f.conta.nome}" (R$ ${Number(f.valorTotal).toFixed(2)}) como PAGA? Esta ação é manual e altera o financeiro.`)) return;
    setProcessando(f.id);
    try {
      await api(`/admin/faturamento/${f.id}/marcar-paga`, { method: 'PATCH' });
      toast.success('Fatura marcada como paga.');
      await carregar(competencia);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao marcar paga'); }
    finally { setProcessando(null); }
  }

  return (
    <Shell area="admin">
      <div className="p-6 space-y-5">
        <h1 className="text-2xl font-bold">Faturamento</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Competência
            <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
              className="block mt-1 ui-input w-40" />
          </label>
          <button onClick={fecharMes} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Fechar faturas do mês</button>
          {data && <div className="ml-auto text-right"><p className="text-xs text-slate-500">MRR ({data.competencia})</p><p className="text-2xl font-bold">R$ {data.mrr.toFixed(2)}</p></div>}
        </div>

        {pix && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">Cobrança Pix — {pix.nome} — R$ {pix.valor.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Copia-e-cola (envie ao cliente):</p>
            <code className="block bg-white dark:bg-slate-800 border rounded p-2 mt-1 break-all text-xs">{pix.copia}</code>
            <div className="mt-2 flex items-center gap-3">
              <CopyButton texto={pix.copia} label="Copiar Pix" />
              <button onClick={() => setPix(null)} className="text-xs text-slate-500 underline">fechar</button>
            </div>
          </div>
        )}

        {boleto && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Boleto gerado — {boleto.nome}</p>
            {boleto.link && <a href={boleto.link} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-tribo-600 dark:text-tribo-400 underline text-xs">Abrir boleto</a>}
            {boleto.linha && (
              <>
                <p className="text-xs text-slate-500 mt-2">Linha digitável:</p>
                <code className="block bg-white dark:bg-slate-800 border rounded p-2 mt-1 break-all text-xs">{boleto.linha}</code>
                <div className="mt-2"><CopyButton texto={boleto.linha} label="Copiar código" /></div>
              </>
            )}
            <button onClick={() => setBoleto(null)} className="block mt-2 text-xs text-slate-500 underline">fechar</button>
          </div>
        )}

        <div className="ui-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
              <tr><th className="px-4 py-2 font-medium">Conta</th><th className="px-4 py-2 font-medium">Uso</th><th className="px-4 py-2 font-medium">Valor</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {!data || data.faturas.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Nenhuma fatura. Clique em "Fechar faturas do mês".</td></tr>
              ) : data.faturas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3">{f.conta.nome}<br /><span className="text-xs text-slate-400">{f.conta.tipoConta}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{f.alunosAtivos != null ? `${f.alunosAtivos} alunos` : `${f.assentosUsados} assentos`}</td>
                  <td className="px-4 py-3">R$ {Number(f.valorTotal).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge tom={f.status === 'paga' ? 'success' : f.status === 'cancelada' ? 'neutral' : 'warning'}>{f.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs space-x-3 whitespace-nowrap">
                    {f.status !== 'paga' && (
                      <>
                        <button disabled={processando === f.id} onClick={() => cobrar(f)} className="text-tribo-600 dark:text-tribo-400 disabled:opacity-40">Cobrar (Pix)</button>
                        <button disabled={processando === f.id} onClick={() => gerarBoleto(f)} className="text-amber-600 dark:text-amber-400 disabled:opacity-40">Boleto</button>
                        <button disabled={processando === f.id} onClick={() => marcarPaga(f)} className="text-emerald-600 dark:text-emerald-400 disabled:opacity-40">Marcar paga</button>
                      </>
                    )}
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
