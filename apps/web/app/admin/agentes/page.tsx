'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Agente {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  icone: string | null;
  url: string;
}

const VAZIO = { nome: '', descricao: '', categoria: '', icone: '🤖', url: '' };

export default function AgentesAdminPage() {
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setAgentes(await api<Agente[]>('/admin/agentes'));
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

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api('/admin/agentes', { method: 'POST', body: JSON.stringify(form) });
      setForm(VAZIO);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este agente?')) return;
    await api(`/admin/agentes/${id}`, { method: 'DELETE' });
    await carregar();
  }

  return (
    <Shell area="admin">
      <div className="p-6 grid lg:grid-cols-[1fr_340px] gap-6">
        <section>
          <h1 className="text-2xl font-bold mb-1">Agentes de IA (corporativo)</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            Aparecem para <b>todos</b> os colaboradores das contas corporativas. Abrem em nova aba.
          </p>
          {agentes.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum agente ainda. Crie ao lado →</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {agentes.map((a) => (
                <div key={a.id} className="ui-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="text-2xl">{a.icone || '🤖'}</div>
                    <button onClick={() => remover(a.id)} className="text-xs text-rose-500 hover:underline">remover</button>
                  </div>
                  <p className="font-semibold mt-1">{a.nome}</p>
                  {a.categoria && <p className="text-xs text-tribo-600 dark:text-tribo-400">{a.categoria}</p>}
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.descricao}</p>
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-slate-400 truncate block mt-2">{a.url}</a>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="ui-card p-5 h-fit">
          <h2 className="font-semibold mb-3">Novo agente</h2>
          {erro && <p className="text-sm text-rose-600 mb-2">{erro}</p>}
          <form onSubmit={criar} className="space-y-3">
            <div className="flex gap-2">
              <input value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })} className="w-14 text-center border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-2 text-sm" />
              <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="flex-1 min-w-0 ui-input" />
            </div>
            <input placeholder="Categoria (ex.: Copy)" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full ui-input" />
            <textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="w-full ui-input" />
            <input placeholder="Link (URL do GPT/Claude/...)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required className="w-full ui-input" />
            <button disabled={salvando} className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm">{salvando ? '...' : 'Criar agente'}</button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
