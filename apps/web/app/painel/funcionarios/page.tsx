'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { Badge } from '../../../components/ui/Badge';
import { CopyButton } from '../../../components/CopyButton';
import { toast } from '../../../lib/toast';

interface Funcionario {
  id: string;
  nome: string;
  email: string;
  funcaoEquipe: 'gerente' | 'atendente';
  ativo: boolean;
  ultimoAcesso: string | null;
}

const LIMITE = 10;
const FUNCAO_LABEL: Record<string, string> = { gerente: 'Gerente', atendente: 'Atendente' };

export default function FuncionariosPage() {
  const router = useRouter();
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [form, setForm] = useState({ nome: '', email: '', funcao: 'atendente' });
  const [conviteLink, setConviteLink] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try { setLista(await api<Funcionario[]>('/painel/funcionarios')); }
    catch (err) { if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); } }
  }, [router]);

  useEffect(() => { if (!getToken()) { router.replace('/login'); return; } carregar(); }, [router, carregar]);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) { toast.error('Preencha nome e e-mail.'); return; }
    try {
      const r = await api<{ conviteEnviado: boolean }>('/painel/funcionarios', { method: 'POST', body: JSON.stringify(form) });
      toast.success(r.conviteEnviado ? 'Convite enviado por e-mail.' : 'Funcionário criado (falha ao enviar o e-mail — reenvie depois).');
      setForm({ nome: '', email: '', funcao: 'atendente' });
      setConviteLink(null);
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao convidar'); }
  }

  async function alterarFuncao(f: Funcionario, funcao: string) {
    try { await api(`/painel/funcionarios/${f.id}`, { method: 'PATCH', body: JSON.stringify({ funcao }) }); await carregar(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }
  async function alternarAtivo(f: Funcionario) {
    try { await api(`/painel/funcionarios/${f.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !f.ativo }) }); await carregar(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }
  async function remover(f: Funcionario) {
    if (!confirm(`Remover o acesso de ${f.nome}?`)) return;
    try { await api(`/painel/funcionarios/${f.id}`, { method: 'DELETE' }); toast.success('Acesso removido.'); await carregar(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  const usados = lista.length;
  const inp = 'w-full ui-input';

  return (
    <Shell area="painel">
      <div className="p-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Funcionários</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Convide sua equipe para trabalhar na plataforma. {usados}/{LIMITE} usados.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <section className="ui-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
                <tr><th className="px-4 py-2 font-medium">Funcionário</th><th className="px-4 py-2 font-medium">Função</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {lista.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Nenhum funcionário. Convide ao lado →</td></tr>
                ) : lista.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3">{f.nome}<br /><span className="text-xs text-slate-400">{f.email}</span></td>
                    <td className="px-4 py-3">
                      <select value={f.funcaoEquipe} onChange={(e) => alterarFuncao(f, e.target.value)} className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1 text-xs">
                        <option value="gerente">Gerente</option>
                        <option value="atendente">Atendente</option>
                      </select>
                    </td>
                    <td className="px-4 py-3"><Badge tom={f.ativo ? 'success' : 'neutral'}>{f.ativo ? 'ativo' : 'inativo'}</Badge></td>
                    <td className="px-4 py-3 text-xs space-x-3 whitespace-nowrap">
                      <button onClick={() => alternarAtivo(f)} className="text-tribo-600 dark:text-tribo-400">{f.ativo ? 'desativar' : 'ativar'}</button>
                      <button onClick={() => remover(f)} className="text-rose-500">remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="ui-card p-5 h-fit">
            <h3 className="font-semibold mb-1">Convidar funcionário</h3>
            <p className="text-xs text-slate-400 mb-3">Ele recebe um e-mail para definir a senha e acessar o painel.</p>
            <form onSubmit={convidar} className="space-y-3">
              <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inp} />
              <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} />
              <label className="block text-xs text-slate-500">Função
                <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className={inp}>
                  <option value="atendente">Atendente (só matrículas/alunos)</option>
                  <option value="gerente">Gerente (tudo, menos time e assinatura)</option>
                </select>
              </label>
              <button disabled={usados >= LIMITE} className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
                {usados >= LIMITE ? 'Limite atingido' : 'Enviar convite'}
              </button>
            </form>
            {conviteLink && (
              <div className="mt-3 text-xs">
                <p className="text-slate-500 mb-1">Link de convite:</p>
                <code className="block bg-slate-50 dark:bg-slate-900/40 border rounded p-2 break-all">{conviteLink}</code>
                <div className="mt-1"><CopyButton texto={conviteLink} label="Copiar link" /></div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
