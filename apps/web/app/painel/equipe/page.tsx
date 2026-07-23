'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { CopyButton } from '../../../components/CopyButton';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { toast } from '../../../lib/toast';

function tomStatus(status: string) {
  if (status === 'ativo') return 'success' as const;
  if (status === 'pendente') return 'warning' as const;
  return 'danger' as const;
}

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  status: string;
  ultimoAcesso: string | null;
}

export default function EquipePage() {
  const router = useRouter();
  const [lista, setLista] = useState<Colaborador[]>([]);
  const [form, setForm] = useState({ nome: '', email: '' });
  const [convite, setConvite] = useState<{ email: string; token: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLista(await api<Colaborador[]>('/painel/colaboradores'));
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

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ conviteToken: string }>('/painel/colaboradores', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setConvite({ email: form.email, token: res.conviteToken });
      setForm({ nome: '', email: '' });
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar');
    }
  }

  async function alternar(id: string, ativo: boolean, nome: string) {
    if (!ativo && !confirm(`Desativar o acesso de "${nome}"?`)) return;
    await api(`/painel/colaboradores/${id}/status`, { method: 'PATCH', body: JSON.stringify({ ativo }) });
    await carregar();
  }

  const linkConvite =
    convite && typeof window !== 'undefined'
      ? `${window.location.origin}/aceitar-convite?token=${convite.token}`
      : '';

  return (
    <Shell area="painel">
      <div className="p-6 grid lg:grid-cols-[1fr_300px] gap-6">
        <section>
          <h1 className="text-xl font-bold mb-4">Equipe</h1>
          <div className="ui-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
                <tr><th className="px-4 py-2 font-medium">Colaborador</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {lista.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Nenhum colaborador ainda.</td></tr>
                ) : lista.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">{c.nome}<br /><span className="text-xs text-slate-400">{c.email}</span></td>
                    <td className="px-4 py-3">
                      <Badge tom={tomStatus(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variante={c.ativo ? 'danger' : 'primary'} onClick={() => alternar(c.id, !c.ativo, c.nome)}>{c.ativo ? 'Desativar' : 'Ativar'}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="ui-card p-5 h-fit">
          <h3 className="font-semibold mb-3">Convidar colaborador</h3>
          {convite && (
            <div className="mb-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-lg p-3 break-all">
              Convite para <b>{convite.email}</b>. O link também é enviado por e-mail:<br />
              <span className="font-mono">{linkConvite}</span>
              <div className="mt-2"><CopyButton texto={linkConvite} label="Copiar link" /></div>
            </div>
          )}
          <form onSubmit={convidar} className="space-y-3">
            <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required
              className="w-full ui-input" />
            <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
              className="w-full ui-input" />
            <button className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2 rounded-lg text-sm">Enviar convite</button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
