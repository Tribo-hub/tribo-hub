'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { CopyButton } from '../../../components/CopyButton';
import { Badge } from '../../../components/ui/Badge';

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
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'infoprodutor' | 'corporativo'>('todos');
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

  const visiveis = contas.filter(
    (c) =>
      (filtroTipo === 'todos' || c.tipoConta === filtroTipo) &&
      (!busca ||
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.slug.toLowerCase().includes(busca.toLowerCase())),
  );

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
            <div key={s.label} className="ui-card p-5">
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

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="🔎 Buscar por nome ou código..."
              className="flex-1 min-w-[180px] border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-1 text-sm">
              {(['todos', 'infoprodutor', 'corporativo'] as const).map((t) => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1.5 rounded-lg capitalize ${filtroTipo === t ? 'bg-tribo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
                  {t === 'todos' ? 'Todos' : t}
                </button>
              ))}
            </div>
          </div>

          {carregando ? (
            <p className="text-slate-500">Carregando...</p>
          ) : visiveis.length === 0 ? (
            <p className="text-slate-500 text-sm">{contas.length === 0 ? 'Nenhuma conta ainda. Crie a primeira ao lado →' : 'Nenhuma conta neste filtro.'}</p>
          ) : (
            <div className="ui-card divide-y divide-slate-100 dark:divide-slate-700">
              {visiveis.map((c) => (
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
                    <Badge tom={c.tipoConta === 'infoprodutor' ? 'brand' : 'info'}>{c.tipoConta}</Badge>
                    <p className="text-xs text-slate-400 mt-1">{c.assinatura?.plano}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* criar */}
        <aside className="ui-card p-5 h-fit">
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
              <div className="flex items-center gap-2 mt-1">
                <span>Senha temporária (fallback): <b>{novoAdmin.senhaTemporaria}</b></span>
                <CopyButton texto={novoAdmin.senhaTemporaria} label="copiar senha" />
              </div>
            </div>
          )}

          <form onSubmit={criar} className="space-y-3">
            <input
              placeholder="Nome da empresa/produtor"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
              className="w-full ui-input"
            />
            <select
              value={form.tipoConta}
              onChange={(e) => setForm({ ...form, tipoConta: e.target.value })}
              className="w-full ui-input"
            >
              <option value="infoprodutor">Infoprodutor</option>
              <option value="corporativo">Corporativo</option>
            </select>
            <input
              placeholder="Nome do admin"
              value={form.adminNome}
              onChange={(e) => setForm({ ...form, adminNome: e.target.value })}
              required
              className="w-full ui-input"
            />
            <input
              type="email"
              placeholder="E-mail do admin"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              required
              className="w-full ui-input"
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
