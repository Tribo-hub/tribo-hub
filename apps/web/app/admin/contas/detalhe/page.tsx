'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';

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

export default function ContaDetalhe() {
  const router = useRouter();
  const [id, setId] = useState('');
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);

  const [conta, setConta] = useState<Conta | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
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
    await api(`/admin/contas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ ativo: !conta.ativo }) });
    await carregar();
  }

  if (!conta) {
    return <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 text-slate-500">{msg || 'Carregando...'}</main>;
  }

  const ehInfo = conta.tipoConta === 'infoprodutor';

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/admin/contas" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">← Contas</Link>
          <span className="font-semibold">Tribo Hub · Super Admin</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {msg && <p className="text-sm text-tribo-600 dark:text-tribo-400">{msg}</p>}

        {/* Cabeçalho da conta */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between">
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

        {/* Plano / assinatura */}
        <form onSubmit={salvarAssinatura} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
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

        {/* Usuários */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
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
    </main>
  );
}
