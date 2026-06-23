'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Conta {
  id: string;
  nome: string;
  tipoConta: 'corporativo' | 'infoprodutor';
  slug: string;
  ativo: boolean;
  assinatura?: { plano: string; tipoCobranca: string } | null;
  _count?: { usuarios: number };
}

interface ListaContas {
  total: number;
  itens: Conta[];
}

interface CriarResposta {
  conta: Conta;
  admin: { email: string; senhaTemporaria: string };
  conviteEnviado: boolean;
}

export default function ContasPage() {
  const router = useRouter();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const [novoAdmin, setNovoAdmin] = useState<CriarResposta['admin'] | null>(null);
  const [conviteEnviado, setConviteEnviado] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    tipoConta: 'infoprodutor',
    adminNome: '',
    adminEmail: '',
  });

  const carregar = useCallback(async () => {
    try {
      const data = await api<ListaContas>('/admin/contas');
      setContas(data.itens);
      setErro('');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    carregar();
  }, [router, carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setCriando(true);
    setErro('');
    try {
      const res = await api<CriarResposta>('/admin/contas', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setNovoAdmin(res.admin);
      setConviteEnviado(res.conviteEnviado);
      setForm({ nome: '', tipoConta: 'infoprodutor', adminNome: '', adminEmail: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setCriando(false);
    }
  }

  return (
    <Shell area="admin">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total de contas', value: contas.length },
            { label: 'Infoprodutores', value: contas.filter((c) => c.tipoConta === 'infoprodutor').length },
            { label: 'Corporativo', value: contas.filter((c) => c.tipoConta === 'corporativo').length },
            { label: 'Ativas', value: contas.filter((c) => c.ativo).length },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className="text-3xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* lista */}
        <section>
          <h1 className="text-xl font-bold mb-4">Contas</h1>
          {erro && <p className="text-sm text-rose-600 mb-3">{erro}</p>}
          {carregando ? (
            <p className="text-slate-500">Carregando...</p>
          ) : contas.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhuma conta ainda. Crie a primeira ao lado →</p>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
              {contas.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/contas/detalhe?id=${c.id}`}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <div>
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-slate-500">
                      {c.slug}.tribohub.com.br · {c._count?.usuarios ?? 0} usuário(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        c.tipoConta === 'infoprodutor'
                          ? 'bg-tribo-100 text-tribo-700 dark:bg-tribo-900/40 dark:text-tribo-300'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      }`}
                    >
                      {c.tipoConta}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">{c.assinatura?.plano}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* criar */}
        <aside className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 h-fit">
          <h2 className="font-semibold mb-3">Nova conta</h2>

          {novoAdmin && (
            <div className="mb-4 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-lg p-3">
              Conta criada! Admin: <b>{novoAdmin.email}</b>
              <br />
              {conviteEnviado ? (
                <span>✉️ Convite enviado por e-mail para o admin definir a senha.</span>
              ) : (
                <span className="opacity-80">⚠️ E-mail não enviado (Resend?). Use a senha temporária abaixo.</span>
              )}
              <br />
              Senha temporária (fallback): <b>{novoAdmin.senhaTemporaria}</b>
            </div>
          )}

          <form onSubmit={criar} className="space-y-3">
            <input
              placeholder="Nome da empresa/produtor"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={form.tipoConta}
              onChange={(e) => setForm({ ...form, tipoConta: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="infoprodutor">Infoprodutor</option>
              <option value="corporativo">Corporativo</option>
            </select>
            <input
              placeholder="Nome do admin"
              value={form.adminNome}
              onChange={(e) => setForm({ ...form, adminNome: e.target.value })}
              required
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="E-mail do admin"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              required
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={criando}
              className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm"
            >
              {criando ? 'Criando...' : 'Criar conta'}
            </button>
          </form>
        </aside>
        </div>
      </div>
    </Shell>
  );
}
