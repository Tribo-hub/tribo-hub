'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { toast } from '../../../lib/toast';

interface Matricula {
  id: string;
  status: string;
  origem: string;
  expiraEm: string | null;
  usuario: { id: string; nome: string; email: string; telefone: string | null };
  trilha: { titulo: string };
  turma?: { nome: string } | null;
}
interface Trilha { id: string; titulo: string }
interface TurmaOpt { id: string; nome: string }
interface EdicaoAluno { id: string; nome: string; email: string; telefone: string; senha: string }

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
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [cortesia, setCortesia] = useState({ email: '', nome: '', trilhaId: '', turmaId: '' });
  const [turmasCortesia, setTurmasCortesia] = useState<TurmaOpt[]>([]);
  const [edicao, setEdicao] = useState<EdicaoAluno | null>(null);

  function onTrilhaCortesia(trilhaId: string) {
    setCortesia((c) => ({ ...c, trilhaId, turmaId: '' }));
    setTurmasCortesia([]);
    if (trilhaId) {
      api<TurmaOpt[]>(`/painel/trilhas/${trilhaId}/turmas`).then((ts) => setTurmasCortesia(ts)).catch(() => {});
    }
  }

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
    if (op === 'inativar' && !confirm('Inativar esta matrícula? O aluno perde o acesso ao curso.')) return;
    try {
      await api(`/painel/matriculas/${id}/${op}`, { method: 'PATCH' });
      toast.success(op === 'inativar' ? 'Matrícula inativada.' : 'Matrícula reativada.');
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar matrícula.');
    }
  }
  async function prorrogar(id: string) {
    const dias = Number(prompt('Prorrogar por quantos dias?', '30'));
    if (!dias || dias < 1) return;
    try {
      await api(`/painel/matriculas/${id}/prorrogar`, { method: 'PATCH', body: JSON.stringify({ dias }) });
      toast.success(`Matrícula prorrogada por ${dias} dias.`);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao prorrogar.');
    }
  }
  async function salvarAluno(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    const payload: Record<string, string> = { nome: edicao.nome, email: edicao.email, telefone: edicao.telefone };
    if (edicao.senha.trim()) payload.senha = edicao.senha.trim();
    try {
      await api(`/painel/alunos/${edicao.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.success('Dados do aluno atualizados.');
      setEdicao(null);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar aluno.');
    }
  }
  async function criarCortesia(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/painel/matriculas/cortesia', {
        method: 'POST',
        body: JSON.stringify({ email: cortesia.email, nome: cortesia.nome, trilhaId: cortesia.trilhaId, turmaId: cortesia.turmaId || undefined }),
      });
      setCortesia({ email: '', nome: '', trilhaId: '', turmaId: '' });
      setTurmasCortesia([]);
      toast.success('Cortesia concedida.');
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
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

  const tomStatus = (s: string): 'success' | 'danger' | 'warning' =>
    s === 'ativa' ? 'success' : s === 'inativa' ? 'danger' : 'warning';

  return (
    <Shell area="painel">
      <div className="p-6 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="ui-card p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Alunos ativos (cobrança)</p>
            <p className="text-3xl font-bold mt-1">{ativos ?? '—'}</p>
          </div>
          <div className="ui-card p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total de matrículas</p>
            <p className="text-3xl font-bold mt-1">{matriculas.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/60 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">A expirar (30 dias)</p>
            <p className="text-3xl font-bold mt-1 text-amber-600">{aExpirar}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          <section className="ui-card overflow-hidden">
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
                    <td className="px-4 py-3">
                      {m.usuario.nome}
                      <br /><span className="text-xs text-slate-400">{m.usuario.email}</span>
                      {m.usuario.telefone && <><br /><span className="text-xs text-slate-400">📞 {m.usuario.telefone}</span></>}
                    </td>
                    <td className="px-4 py-3">{m.trilha.titulo}{m.turma?.nome && <><br /><span className="text-xs text-tribo-600">🎓 {m.turma.nome}</span></>}<br /><span className="text-xs text-slate-400">{m.origem}</span></td>
                    <td className="px-4 py-3 text-xs">{m.expiraEm ? new Date(m.expiraEm).toLocaleDateString('pt-BR') : 'vitalício'}</td>
                    <td className="px-4 py-3"><Badge tom={tomStatus(m.status)}>{m.status}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Button variante="secondary" onClick={() => setEdicao({ id: m.usuario.id, nome: m.usuario.nome, email: m.usuario.email, telefone: m.usuario.telefone ?? '', senha: '' })}>Editar</Button>
                        {m.status === 'ativa' ? (
                          <>
                            <Button variante="secondary" onClick={() => prorrogar(m.id)}>Prorrogar</Button>
                            <Button variante="danger" onClick={() => acao(m.id, 'inativar')}>Inativar</Button>
                          </>
                        ) : (
                          <Button variante="primary" onClick={() => acao(m.id, 'reativar')}>Reativar</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="ui-card p-5 h-fit">
            <h3 className="font-semibold mb-3">Conceder cortesia</h3>
            <form onSubmit={criarCortesia} className="space-y-3">
              <input placeholder="E-mail do aluno" type="email" value={cortesia.email} onChange={(e) => setCortesia({ ...cortesia, email: e.target.value })} required
                className="w-full ui-input" />
              <input placeholder="Nome" value={cortesia.nome} onChange={(e) => setCortesia({ ...cortesia, nome: e.target.value })} required
                className="w-full ui-input" />
              <select value={cortesia.trilhaId} onChange={(e) => onTrilhaCortesia(e.target.value)} required
                className="w-full ui-input">
                <option value="">Selecione a trilha…</option>
                {trilhas.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
              {turmasCortesia.length > 0 && (
                <select value={cortesia.turmaId} onChange={(e) => setCortesia({ ...cortesia, turmaId: e.target.value })}
                  className="w-full ui-input">
                  <option value="">Turma automática (matrículas abertas)</option>
                  {turmasCortesia.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              )}
              <button className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2 rounded-lg text-sm">Conceder</button>
            </form>
          </aside>
        </div>
      </div>

      {edicao && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={salvarAluno} className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Editar aluno</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Nome</label>
                <input value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} required
                  className="w-full ui-input" />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">E-mail</label>
                <input type="email" value={edicao.email} onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} required
                  className="w-full ui-input" />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Telefone</label>
                <input value={edicao.telefone} onChange={(e) => setEdicao({ ...edicao, telefone: e.target.value })} placeholder="(00) 00000-0000"
                  className="w-full ui-input" />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Nova senha (deixe em branco para manter)</label>
                <input type="password" value={edicao.senha} onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })} minLength={6} placeholder="••••••"
                  className="w-full ui-input" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button type="button" onClick={() => setEdicao(null)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2">Cancelar</button>
              <button type="submit" className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}
