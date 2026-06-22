'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

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
  const [msg, setMsg] = useState('');
  const [pix, setPix] = useState<{ nome: string; valor: number; copia: string } | null>(null);

  const carregar = useCallback(async (comp: string) => {
    try {
      setData(await api<Lista>(`/admin/faturamento?competencia=${comp}`));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
      setMsg(err instanceof Error ? err.message : 'Erro');
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar(competencia);
  }, [router, carregar, competencia]);

  async function fecharMes() {
    setMsg('Fechando faturas...');
    await api('/admin/faturamento/fechar', { method: 'POST', body: JSON.stringify({ competencia }) });
    setMsg('Faturas do mês fechadas.');
    await carregar(competencia);
  }

  async function cobrar(f: Fatura) {
    setMsg('Gerando cobrança Pix...');
    try {
      const r = await api<{ valor: number; pixCopiaECola: string }>(`/admin/faturamento/${f.id}/cobrar`, { method: 'POST' });
      setPix({ nome: f.conta.nome, valor: r.valor, copia: r.pixCopiaECola });
      setMsg('');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Erro ao cobrar (Efí configurada?)'); }
  }

  async function marcarPaga(f: Fatura) {
    await api(`/admin/faturamento/${f.id}/marcar-paga`, { method: 'PATCH' });
    await carregar(competencia);
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/admin/contas" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">← Contas</Link>
          <span className="font-semibold">Faturamento</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Competência
            <input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="YYYY-MM"
              className="block mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm w-32" />
          </label>
          <button onClick={fecharMes} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Fechar faturas do mês</button>
          {data && <div className="ml-auto text-right"><p className="text-xs text-slate-500">MRR ({data.competencia})</p><p className="text-2xl font-bold">R$ {data.mrr.toFixed(2)}</p></div>}
        </div>

        {msg && <p className="text-sm text-tribo-600 dark:text-tribo-400">{msg}</p>}

        {pix && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">Cobrança Pix — {pix.nome} — R$ {pix.valor.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Copia-e-cola (envie ao cliente):</p>
            <code className="block bg-white dark:bg-slate-800 border rounded p-2 mt-1 break-all text-xs">{pix.copia}</code>
            <button onClick={() => setPix(null)} className="mt-2 text-xs text-slate-500 underline">fechar</button>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'paga' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : f.status === 'cancelada' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-tribo-600 dark:text-tribo-400 space-x-3">
                    {f.status !== 'paga' && <><button onClick={() => cobrar(f)}>Cobrar (Pix)</button><button onClick={() => marcarPaga(f)}>Marcar paga</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
