'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { PainelNav } from '../PainelNav';

interface Dash {
  tipo: string;
  totalColaboradores?: number;
  ativos7d?: number;
  engajamento?: number;
  trilhasConcluidas?: number;
  alunosAtivos?: number;
  totalMatriculas?: number;
  certificadosEmitidos?: number;
}
interface Rank { usuarioId: string; nome: string; aulasConcluidas: number }
interface Inativo { id: string; nome: string; email: string; ultimoAcesso: string | null }

export default function DashboardPage() {
  const router = useRouter();
  const [dash, setDash] = useState<Dash | null>(null);
  const [ranking, setRanking] = useState<Rank[]>([]);
  const [inativos, setInativos] = useState<Inativo[]>([]);

  const carregar = useCallback(async () => {
    try {
      const d = await api<Dash>('/painel/dashboard');
      setDash(d);
      if (d.tipo === 'corporativo') {
        setRanking(await api<Rank[]>('/painel/dashboard/ranking'));
        setInativos(await api<Inativo[]>('/painel/dashboard/inativos'));
      }
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

  const Card = ({ label, value }: { label: string; value: number | string }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <PainelNav />
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        {!dash ? (
          <p className="text-slate-500">Carregando...</p>
        ) : dash.tipo === 'corporativo' ? (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card label="Colaboradores" value={dash.totalColaboradores ?? 0} />
              <Card label="Ativos (7 dias)" value={dash.ativos7d ?? 0} />
              <Card label="Engajamento" value={`${dash.engajamento ?? 0}%`} />
              <Card label="Trilhas concluídas" value={dash.trilhasConcluidas ?? 0} />
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold mb-3">Ranking</p>
                {ranking.length === 0 ? <p className="text-sm text-slate-400">Sem dados ainda.</p> : (
                  <ol className="space-y-2 text-sm">
                    {ranking.map((r, i) => (
                      <li key={r.usuarioId} className="flex items-center gap-3">
                        <span className="w-6 h-6 grid place-items-center rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold">{i + 1}</span>
                        {r.nome}<span className="ml-auto text-slate-500">{r.aulasConcluidas} aulas</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold mb-3">Inativos (7+ dias)</p>
                {inativos.length === 0 ? <p className="text-sm text-slate-400">Ninguém inativo. 🎉</p> : (
                  <div className="space-y-2 text-sm">
                    {inativos.map((u) => (
                      <div key={u.id} className="flex justify-between">
                        <span>{u.nome}</span>
                        <span className="text-slate-400 text-xs">{u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleDateString('pt-BR') : 'nunca acessou'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            <Card label="Alunos ativos" value={dash.alunosAtivos ?? 0} />
            <Card label="Matrículas (total)" value={dash.totalMatriculas ?? 0} />
            <Card label="Certificados" value={dash.certificadosEmitidos ?? 0} />
          </div>
        )}
      </div>
    </main>
  );
}
