'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Dashboard {
  competencia: string;
  mrr: number;
  arr: number;
  ticketMedio: number;
  churn: number;
  contasAtivas: number;
  inadimplentes: number;
  canceladas: number;
  faturasVencidas: number;
  historicoMrr: { competencia: string; mrr: number }[];
}

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinanceiroPage() {
  const router = useRouter();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [d, setD] = useState<Dashboard | null>(null);

  const carregar = useCallback(async (comp: string) => {
    try {
      setD(await api<Dashboard>(`/admin/financeiro/dashboard?competencia=${comp}`));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); }
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar(competencia);
  }, [router, carregar, competencia]);

  const maxMrr = d ? Math.max(1, ...d.historicoMrr.map((h) => h.mrr)) : 1;

  const cards = d
    ? [
        { label: 'MRR (receita do mês)', valor: brl(d.mrr) },
        { label: 'ARR (anualizado)', valor: brl(d.arr) },
        { label: 'Ticket médio', valor: brl(d.ticketMedio) },
        { label: 'Churn', valor: `${d.churn.toFixed(1)}%` },
        { label: 'Contas ativas', valor: String(d.contasAtivas) },
        { label: 'Inadimplentes', valor: String(d.inadimplentes), alerta: d.inadimplentes > 0 },
        { label: 'Faturas vencidas', valor: String(d.faturasVencidas), alerta: d.faturasVencidas > 0 },
        { label: 'Canceladas', valor: String(d.canceladas) },
      ]
    : [];

  return (
    <Shell area="admin">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <label className="text-sm">Competência
            <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="block mt-1 ui-input w-40" />
          </label>
        </div>

        {!d ? (
          <p className="text-slate-500">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {cards.map((c) => (
                <div key={c.label} className="ui-card p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.alerta ? 'text-rose-600' : ''}`}>{c.valor}</p>
                </div>
              ))}
            </div>

            {/* MRR 6 meses */}
            <div className="ui-card p-5">
              <p className="font-semibold mb-4">MRR — últimos 6 meses</p>
              <div className="flex items-end gap-3 h-40">
                {d.historicoMrr.map((h) => (
                  <div key={h.competencia} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className="text-[11px] text-slate-500">{brl(h.mrr)}</span>
                    <div className="w-full bg-tribo-500/80 rounded-t" style={{ height: `${Math.max(4, (h.mrr / maxMrr) * 120)}px` }} />
                    <span className="text-[11px] text-slate-400">{h.competencia.slice(5)}/{h.competencia.slice(2, 4)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400">MRR = soma das faturas pagas da competência. Ticket = MRR ÷ contas ativas. Churn = canceladas ÷ (ativas + canceladas).</p>
          </>
        )}
      </div>
    </Shell>
  );
}
