'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Dash {
  tipo: string;
  totalColaboradores?: number;
  ativos7d?: number;
  engajamento?: number;
  trilhasConcluidas?: number;
  alunosAtivos?: number;
  totalMatriculas?: number;
  certificadosEmitidos?: number;
  novosNoMes?: number;
  aExpirar?: number;
  taxaConclusao?: number;
  hotmartConectada?: boolean;
}
interface Fatura { valorBase: number; valorExcedente: number; valorTotal: number }
interface Rank { usuarioId: string; nome: string; aulasConcluidas: number }
interface Inativo { id: string; nome: string; ultimoAcesso: string | null }
interface Curso { trilhaId: string; titulo: string; matriculas: number; certificados: number; taxaConclusao: number; avaliacaoMedia: number | null; avaliacoes: number }
interface Venda { id: string; aluno: string; valor: number; data: string }
interface Vendas { receitaMes: number; vendasMes: number; ultimas: Venda[] }

function Card({ label, value, hint, alerta }: { label: string; value: string | number; hint?: string; alerta?: boolean }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl p-5 border ${alerta ? 'border-amber-200 dark:border-amber-900/60' : 'border-slate-200 dark:border-slate-700'}`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${alerta ? 'text-amber-600' : ''}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [dash, setDash] = useState<Dash | null>(null);
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [ranking, setRanking] = useState<Rank[]>([]);
  const [inativos, setInativos] = useState<Inativo[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [vendas, setVendas] = useState<Vendas | null>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await api<Dash>('/painel/dashboard');
      setDash(d);
      if (d.tipo === 'corporativo') {
        setRanking(await api<Rank[]>('/painel/dashboard/ranking'));
        setInativos(await api<Inativo[]>('/painel/dashboard/inativos'));
      } else {
        const [f, c, v] = await Promise.all([
          api<Fatura>('/painel/minha-fatura'),
          api<Curso[]>('/painel/dashboard/cursos'),
          api<Vendas>('/painel/dashboard/vendas'),
        ]);
        setFatura(f);
        setCursos(c);
        setVendas(v);
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

  return (
    <Shell area="painel">
      <div className="p-6 space-y-6">
        {!dash ? (
          <p className="text-slate-500">Carregando...</p>
        ) : dash.tipo === 'corporativo' ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Dashboard da equipe</h1>
              <Link href="/painel/equipe" className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">+ Convidar colaborador</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card label="Colaboradores" value={dash.totalColaboradores ?? 0} />
              <Card label="Ativos (7 dias)" value={dash.ativos7d ?? 0} />
              <Card label="Engajamento" value={`${dash.engajamento ?? 0}%`} />
              <Card label="Trilhas concluídas" value={dash.trilhasConcluidas ?? 0} />
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold mb-3">Ranking de colaboradores</p>
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
                <p className="font-semibold mb-1">Inativos (7+ dias)</p>
                {inativos.length === 0 ? <p className="text-sm text-slate-400 mt-3">Ninguém inativo. 🎉</p> : (
                  <div className="space-y-2 text-sm mt-2">
                    {inativos.map((u) => (
                      <div key={u.id} className="flex justify-between"><span>{u.nome}</span><span className="text-slate-400 text-xs">{u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleDateString('pt-BR') : 'nunca'}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${dash.hotmartConectada ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                {dash.hotmartConectada ? 'Hotmart conectada' : 'Hotmart não conectada'}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card label="Alunos ativos" value={dash.alunosAtivos ?? 0} hint="matrículas ativas (cobrança)" />
              <Card label="Novos no mês" value={`+${dash.novosNoMes ?? 0}`} hint="matrículas no mês" />
              <Card label="Taxa de conclusão" value={`${dash.taxaConclusao ?? 0}%`} hint="certificados / matrículas" />
              <Card label="Matrículas a expirar (30d)" value={dash.aExpirar ?? 0} hint="renovar ou prorrogar" alerta />
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 lg:col-span-2">
                <p className="font-semibold mb-2">Resumo</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500 dark:text-slate-400">Total de matrículas</p><p className="text-2xl font-bold">{dash.totalMatriculas ?? 0}</p></div>
                  <div><p className="text-slate-500 dark:text-slate-400">Certificados emitidos</p><p className="text-2xl font-bold">{dash.certificadosEmitidos ?? 0}</p></div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold mb-4">Cobrança deste mês</p>
                {fatura ? (
                  <>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Plano base</p><p className="text-lg font-semibold">R$ {fatura.valorBase.toFixed(2)}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Excedente</p><p className="text-lg font-semibold">R$ {fatura.valorExcedente.toFixed(2)}</p>
                    <hr className="my-3 border-slate-200 dark:border-slate-700" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total estimado</p><p className="text-2xl font-bold text-tribo-700 dark:text-tribo-400">R$ {fatura.valorTotal.toFixed(2)}</p>
                  </>
                ) : <p className="text-sm text-slate-400">—</p>}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Conclusão por curso */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold mb-3">Conclusão por curso</p>
                {cursos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum curso ainda.</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {cursos.map((c) => (
                      <div key={c.trilhaId}>
                        <div className="flex justify-between mb-1">
                          <span className="truncate">{c.titulo}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {c.avaliacaoMedia ? `★ ${c.avaliacaoMedia} · ` : ''}{c.taxaConclusao}% · {c.matriculas} mat.
                          </span>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                          <div className="bg-tribo-600 h-1.5 rounded-full" style={{ width: `${c.taxaConclusao}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vendas do mês */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="font-semibold">Vendas do mês</p>
                  {vendas && (
                    <span className="text-sm text-emerald-600 font-semibold">
                      R$ {vendas.receitaMes.toFixed(2)} · {vendas.vendasMes} venda(s)
                    </span>
                  )}
                </div>
                {!vendas || vendas.ultimas.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma venda registrada (chega via webhook das plataformas).</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                    {vendas.ultimas.map((v) => (
                      <li key={v.id} className="py-2 flex justify-between">
                        <span className="truncate">{v.aluno}</span>
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          R$ {v.valor.toFixed(2)} · {new Date(v.data).toLocaleDateString('pt-BR')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
