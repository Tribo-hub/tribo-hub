'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';
import { Shell } from '../../../../components/Shell';
import { Switch } from '../../../../components/Switch';
import { ContaFinanceiro } from '../../../../components/ContaFinanceiro';
import { toast } from '../../../../lib/toast';

interface Assinatura {
  plano: string;
  tipoCobranca: string;
  valorBase: string;
  limiteUsuarios: number | null;
  alunosIncluidos: number | null;
  valorPorExcedente: string | null;
  status: string;
}
interface Conta {
  id: string;
  nome: string;
  tipoConta: 'corporativo' | 'infoprodutor';
  slug: string;
  ativo: boolean;
  permiteAutoCadastro: boolean;
  permiteComentarios: boolean;
  sessaoUnica: boolean;
  assinatura: Assinatura | null;
  _count?: { usuarios: number };
}
interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
}
interface Metricas {
  tipo: string;
  matriculas?: number;
  matriculasAtivas?: number;
  colaboradores?: number;
  colaboradoresAtivos?: number;
  certificados?: number;
  ultimaFatura?: { competencia: string; valorTotal: string; status: string } | null;
}

export default function ContaDetalhe() {
  const router = useRouter();
  const [id, setId] = useState('');
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);

  const [conta, setConta] = useState<Conta | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ plano: '', valorBase: '', limiteUsuarios: '', alunosIncluidos: '', valorPorExcedente: '' });

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const c = await api<Conta>(`/admin/contas/${id}`);
      setConta(c);
      if (c.assinatura) {
        setForm({
          plano: c.assinatura.plano ?? '',
          valorBase: String(c.assinatura.valorBase ?? ''),
          limiteUsuarios: c.assinatura.limiteUsuarios != null ? String(c.assinatura.limiteUsuarios) : '',
          alunosIncluidos: c.assinatura.alunosIncluidos != null ? String(c.assinatura.alunosIncluidos) : '',
          valorPorExcedente: c.assinatura.valorPorExcedente != null ? String(c.assinatura.valorPorExcedente) : '',
        });
      }
      setUsuarios(await api<Usuario[]>(`/admin/contas/${id}/usuarios`));
      setMetricas(await api<Metricas>(`/admin/contas/${id}/metricas`));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
      setMsg(err instanceof Error ? err.message : 'Erro');
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  async function salvarAssinatura(e: React.FormEvent) {
    e.preventDefault();
    const ehInfo = conta?.tipoConta === 'infoprodutor';
    const body: Record<string, unknown> = { plano: form.plano, valorBase: Number(form.valorBase) };
    if (ehInfo) {
      body.alunosIncluidos = Number(form.alunosIncluidos || 0);
      body.valorPorExcedente = Number(form.valorPorExcedente || 0);
    } else {
      body.limiteUsuarios = Number(form.limiteUsuarios || 1);
    }
    try {
      await api(`/admin/contas/${id}/assinatura`, { method: 'PATCH', body: JSON.stringify(body) });
      setMsg('Plano atualizado.');
      await carregar();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Erro'); }
  }

  async function alternarStatus() {
    if (!conta) return;
    const aviso = conta.ativo
      ? `Suspender a conta "${conta.nome}"? Os usuários dela perdem o acesso até a reativação.`
      : `Reativar a conta "${conta.nome}"?`;
    if (!confirm(aviso)) return;
    try {
      await api(`/admin/contas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ ativo: !conta.ativo }) });
      toast.success(conta.ativo ? 'Conta suspensa.' : 'Conta reativada.');
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  }

  async function salvarFlag(body: Record<string, boolean>, ok: string) {
    try {
      await api(`/admin/contas/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success(ok);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  function alternarAutoCadastro() {
    if (conta) salvarFlag({ permiteAutoCadastro: !conta.permiteAutoCadastro }, 'Configuração salva.');
  }
  function alternarComentarios() {
    if (conta) salvarFlag({ permiteComentarios: !conta.permiteComentarios }, 'Configuração salva.');
  }
  function alternarSessaoUnica() {
    if (conta) salvarFlag({ sessaoUnica: !conta.sessaoUnica }, 'Configuração salva.');
  }

  if (!conta) {
    return <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 text-slate-500">{msg || 'Carregando...'}</main>;
  }

  const ehInfo = conta.tipoConta === 'infoprodutor';

  return (
    <Shell area="admin">
      <div className="p-6 max-w-4xl space-y-6">
        <Link href="/admin/contas" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">← Contas</Link>
        {msg && <p className="text-sm text-tribo-600 dark:text-tribo-400">{msg}</p>}

        {/* Cabeçalho da conta */}
        <div className="ui-card p-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{conta.nome}</h1>
            <p className="text-xs text-slate-500">{conta.slug}.tribohub.com.br · {conta.tipoConta} · {conta._count?.usuarios ?? 0} usuário(s)</p>
          </div>
          <button
            onClick={alternarStatus}
            className={`text-sm font-semibold px-4 py-2 rounded-lg ${conta.ativo ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}
          >
            {conta.ativo ? 'Suspender conta' : 'Reativar conta'}
          </button>
        </div>

        {/* Auto-cadastro (somente infoprodutor) */}
        {ehInfo && (
          <div className="ui-card p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold">Auto-cadastro de alunos</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permite que alunos criem conta sozinhos em <code>/cadastro</code> (área de membros).
              </p>
            </div>
            <Switch checked={conta.permiteAutoCadastro} onChange={alternarAutoCadastro} label="Auto-cadastro de alunos" />
          </div>
        )}

        {/* Comentários por aula (qualquer tipo de conta) */}
        <div className="ui-card p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold">Comentários nas aulas</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Permite que alunos comentem nas aulas e o produtor responda (engajamento).
            </p>
          </div>
          <Switch checked={conta.permiteComentarios} onChange={alternarComentarios} label="Comentários nas aulas" />
        </div>

        {/* Anti-compartilhamento (qualquer tipo de conta) */}
        <div className="ui-card p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold">Sessão única (anti-compartilhamento)</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Permite apenas um dispositivo logado por aluno. Um novo login encerra o anterior.
            </p>
          </div>
          <Switch checked={conta.sessaoUnica} onChange={alternarSessaoUnica} label="Sessão única" />
        </div>

        {/* Métricas */}
        {metricas && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(metricas.tipo === 'infoprodutor'
              ? [
                  { label: 'Matrículas', value: metricas.matriculas ?? 0 },
                  { label: 'Ativas (cobrança)', value: metricas.matriculasAtivas ?? 0 },
                  { label: 'Certificados', value: metricas.certificados ?? 0 },
                  {
                    label: 'Última fatura',
                    value: metricas.ultimaFatura ? `R$ ${Number(metricas.ultimaFatura.valorTotal).toFixed(2)}` : '—',
                  },
                ]
              : [
                  { label: 'Colaboradores', value: metricas.colaboradores ?? 0 },
                  { label: 'Ativos', value: metricas.colaboradoresAtivos ?? 0 },
                  { label: 'Certificados', value: metricas.certificados ?? 0 },
                  {
                    label: 'Última fatura',
                    value: metricas.ultimaFatura ? `R$ ${Number(metricas.ultimaFatura.valorTotal).toFixed(2)}` : '—',
                  },
                ]
            ).map((m) => (
              <div key={m.label} className="ui-card p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">{m.label}</p>
                <p className="text-2xl font-bold mt-1">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Plano / assinatura */}
        <form onSubmit={salvarAssinatura} className="ui-card p-5 space-y-3">
          <h2 className="font-semibold">Plano & cobrança</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <label className="block">Plano
              <input value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })}
                className="w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2" />
            </label>
            <label className="block">Valor base (R$)
              <input type="number" step="0.01" value={form.valorBase} onChange={(e) => setForm({ ...form, valorBase: e.target.value })}
                className="w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2" />
            </label>
            {ehInfo ? (
              <>
                <label className="block">Alunos incluídos
                  <input type="number" value={form.alunosIncluidos} onChange={(e) => setForm({ ...form, alunosIncluidos: e.target.value })}
                    className="w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2" />
                </label>
                <label className="block">Valor por aluno excedente (R$)
                  <input type="number" step="0.01" value={form.valorPorExcedente} onChange={(e) => setForm({ ...form, valorPorExcedente: e.target.value })}
                    className="w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2" />
                </label>
              </>
            ) : (
              <label className="block">Limite de usuários (assentos)
                <input type="number" value={form.limiteUsuarios} onChange={(e) => setForm({ ...form, limiteUsuarios: e.target.value })}
                  className="w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2" />
              </label>
            )}
          </div>
          <button className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Salvar plano</button>
        </form>

        {/* Financeiro: plano do catálogo, trial, desconto, cobrança avulsa e notas */}
        <ContaFinanceiro contaId={id} onChanged={carregar} />

        {/* Usuários */}
        <div className="ui-card">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold">Usuários</div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
            {usuarios.length === 0 ? (
              <li className="px-5 py-3 text-slate-400">Nenhum usuário.</li>
            ) : usuarios.map((u) => (
              <li key={u.id} className="px-5 py-3 flex items-center justify-between">
                <span>{u.nome} <span className="text-xs text-slate-400">{u.email}</span></span>
                <span className="text-xs">
                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded mr-2">{u.role}</span>
                  <span className={u.ativo ? 'text-emerald-600' : 'text-slate-400'}>{u.ativo ? 'ativo' : 'inativo'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Shell>
  );
}
