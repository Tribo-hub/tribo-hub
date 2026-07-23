'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface LinkExterno {
  id: string;
  nome: string;
  url: string;
}

export default function MenuLinksPage() {
  const router = useRouter();
  const [links, setLinks] = useState<LinkExterno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ nome: '', url: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLinks(await api<LinkExterno[]>('/admin/menu-links'));
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

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api('/admin/menu-links', { method: 'POST', body: JSON.stringify(form) });
      setForm({ nome: '', url: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao adicionar');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este atalho do menu?')) return;
    await api(`/admin/menu-links/${id}`, { method: 'DELETE' });
    await carregar();
  }

  return (
    <Shell area="admin">
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-1">Atalhos do menu</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          Botões que aparecem no seu menu lateral (Super Admin) e abrem em uma nova aba.
        </p>

        <form
          onSubmit={adicionar}
          className="ui-card p-5 mb-6"
        >
          <div className="grid sm:grid-cols-[1fr_1.5fr_auto] gap-3 items-end">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Nome do botão</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                maxLength={60}
                placeholder="Ex.: Supabase"
                className="w-full mt-1 ui-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Link (abre em nova aba)</label>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
                placeholder="https://app.supabase.com/..."
                className="w-full mt-1 ui-input"
              />
            </div>
            <button
              type="submit"
              disabled={salvando}
              className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm h-[38px]"
            >
              {salvando ? '...' : 'Adicionar'}
            </button>
          </div>
          {erro && <p className="text-sm text-rose-600 mt-3">{erro}</p>}
        </form>

        <div className="ui-card divide-y divide-slate-100 dark:divide-slate-700">
          {carregando ? (
            <p className="px-5 py-4 text-slate-500 text-sm">Carregando...</p>
          ) : links.length === 0 ? (
            <p className="px-5 py-4 text-slate-500 text-sm">Nenhum atalho ainda. Adicione o primeiro acima ↑</p>
          ) : (
            links.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center gap-3">
                <span>🔗</span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{l.nome}</p>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-tribo-600 dark:text-tribo-400 truncate block">
                    {l.url}
                  </a>
                </div>
                <button onClick={() => remover(l.id)} className="ml-auto text-xs text-rose-600 hover:text-rose-700">
                  Remover
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Shell>
  );
}
