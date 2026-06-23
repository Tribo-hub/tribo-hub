'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Matricula {
  id: string;
  status: string;
  origem: string;
  expiraEm: string | null;
  usuario: { nome: string; email: string };
  trilha: { titulo: string };
}
interface Trilha { id: string; titulo: string }

type Filtro = 'todas' | 'ativas' | 'expirar';

function expiraEmBreve(m: Matricula) {
  if (m.status !== 'ativa' || !m.expiraEm) return false;
  const dias = (new Date(m.expiraEm).getTime() - Date.now()) / 86_400_000;
  return dias >= 0 && dias <= 30;
}

export default function MatriculasPage() {
  const router = useRouter();
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [ativos, setAtivos] = useState<number | null>(null);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [msg, setMsg] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [cortesia, setCortesia] = useState({ email: '', nome: '', trilhaId: '' });

  const carregar = useCallback(async () => {
    try {
      setMatriculas(await api<Matricula[]>('/painel/matriculas'));
      const a = await api<{ alunosAtivos: number }>('/painel/alunos-ativos');
      setAtivos(a.alunosAtivos);
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

  async function acao(id: string, op: 'inativar' | 'reativar') {
    await api(`/painel/matriculas/${id}/${op}`, { method: 'PATCH' });
    await carregar();
  }
  async function prorrogar(id: string) {
    const dias = Number(prompt('Prorrogar por quantos dias?', '30'));
    if (!dias) return;
    await api(`/painel/matriculas/${id}/prorrogar`, { method: 'PATCH', body: JSON.stringify({ dias }) });
    await carregar();
  }
  async function criarCortesia(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/painel/matriculas/cortesia', { method: 'POST', body: JSON.stringify(cortesia) });
      setCortesia({ email: '', nome: '', trilhaId: '' });
      setMsg('Cortesia concedida.');
      await carregar();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Erro'); }
  }

  const aExpirar = matriculas.filter(expiraEmBreve).length;
  const visiveis = matriculas.filter((m) =>
    filtro === 'ativas' ? m.status === 'ativa' : filtro === 'expirar' ? expiraEmBreve(m) : true,
  );
  const tabs: { k: Filtro; label: string; n: number }[] = [
    { k: 'todas', label: 'Todas', n: matriculas.length },
    { k: 'ativas', label: 'Ativas', n: matriculas.filter((m) => m.status === 'ativa').length },
    { k: 'expirar', label: 'A expirar (30d)', n: aExpirar },
  ];

  const badge = (s: string) =>
    s === 'ativa' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : s === 'inativa' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

  return (
    <Shell area="painel">
      <div className="p-6 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Alunos ativos (cobrança)</p>
            <p className="text-3xl font-bold mt-1">{ativos ?? '—'}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total de matrículas</p>
            <p className="text-3xl font-bold mt-1">{matriculas.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/60 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">A expirar (30 dias)</p>
            <p className="text-3xl font-bold mt-1 text-amber-600">{aExpirar}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex gap-1 p-2 border-b border-slate-100 dark:border-slate-700 text-sm">
              {tabs.map((t) => (
                <button key={t.k} onClick={() => setFiltro(t.k)}
                  className={`px-3 py-1.5 rounded-lg font-medium ${filtro === t.k ? 'bg-tribo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  {t.label} <span className="opacity-70">({t.n})</span>
                </button>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
                <tr><th className="px-4 py-2 font-medium">Aluno</th><th className="px-4 py-2 font-medium">Curso</th><th className="px-4 py-2 font-medium">Expira</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visiveis.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Nenhuma matrícula {filtro !== 'todas' ? 'neste filtro' : 'ainda'}.</td></tr>
                ) : visiveis.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">{m.usuario.nome}<br /><span className="text-xs text-slate-400">{m.usuario.email}</span></td>
                    <td className="px-4 py-3">{m.trilha.titulo}<br /><span className="text-xs text-slate-400">{m.origem}</span></td>
                    <td className="px-4 py-3 text-xs">{m.expiraEm ? new Date(m.expiraEm).toLocaleDateString('pt-BR') : 'vitalício'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${badge(m.status)}`}>{m.status}</span></td>
                    <td className="px-4 py-3 text-xs text-tribo-600 dark:text-tribo-400 space-x-2">
                      {m.status === 'ativa'
                        ? <><button onClick={() => prorrogar(m.id)}>prorrogar</button><button onClick={() => acao(m.id, 'inativar')}>inativar</button></>
                        : <button onClick={() => acao(m.id, 'reativar')}>reativar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 h-fit">
            <h3 className="font-semibold mb-3">Conceder cortesia</h3>
            {msg && <p className="text-xs text-tribo-600 dark:text-tribo-400 mb-2">{msg}</p>}
            <form onSubmit={criarCortesia} className="space-y-3">
              <input placeholder="E-mail do aluno" type="email" value={cortesia.email} onChange={(e) => setCortesia({ ...cortesia, email: e.target.value })} required
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Nome" value={cortesia.nome} onChange={(e) => setCortesia({ ...cortesia, nome: e.target.value })} required
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm" />
              <select value={cortesia.trilhaId} onChange={(e) => setCortesia({ ...cortesia, trilhaId: e.target.value })} required
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione a trilha…</option>
                {trilhas.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
              <button className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2 rounded-lg text-sm">Conceder</button>
            </form>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
