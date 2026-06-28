'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { toast } from '../../../lib/toast';

interface Plano {
  id: string;
  slug: string;
  nome: string;
  tipoConta: 'infoprodutor' | 'corporativo';
  valorBase: string;
  alunosIncluidos: number | null;
  valorPorExcedente: string | null;
  limiteUsuarios: number | null;
  ativo: boolean;
}

const vazio = { slug: '', nome: '', tipoConta: 'infoprodutor', valorBase: '', alunosIncluidos: '', valorPorExcedente: '', limiteUsuarios: '' };

export default function CatalogoPage() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [form, setForm] = useState({ ...vazio });

  const carregar = useCallback(async () => {
    try { setPlanos(await api<Plano[]>('/admin/planos-catalogo')); }
    catch (err) { if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); } }
  }, [router]);

  useEffect(() => { if (!getToken()) { router.replace('/login'); return; } carregar(); }, [router, carregar]);

  const ehInfo = form.tipoConta === 'infoprodutor';

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug.trim() || !form.nome.trim() || !form.valorBase) { toast.error('Preencha slug, nome e valor base.'); return; }
    try {
      await api('/admin/planos-catalogo', {
        method: 'POST',
        body: JSON.stringify({
          slug: form.slug.trim(),
          nome: form.nome.trim(),
          tipoConta: form.tipoConta,
          valorBase: Number(form.valorBase),
          alunosIncluidos: ehInfo ? Number(form.alunosIncluidos || 0) : null,
          valorPorExcedente: ehInfo ? Number(form.valorPorExcedente || 0) : null,
          limiteUsuarios: ehInfo ? null : Number(form.limiteUsuarios || 1),
        }),
      });
      setForm({ ...vazio });
      toast.success('Plano criado.');
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao criar'); }
  }

  async function alternarAtivo(p: Plano) {
    try {
      if (p.ativo) { await api(`/admin/planos-catalogo/${p.id}`, { method: 'DELETE' }); }
      else { await api(`/admin/planos-catalogo/${p.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: true }) }); }
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  const inp = 'w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm';

  return (
    <Shell area="admin">
      <div className="p-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de planos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Padronize os planos. No detalhe da conta você aplica um plano e ele copia estes valores para a assinatura.</p>
        </div>

        <form onSubmit={criar} className="ui-card p-5 space-y-3">
          <h2 className="font-semibold">Novo plano</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <label className="block">Slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="essencial" className={inp} /></label>
            <label className="block">Nome<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Essencial" className={inp} /></label>
            <label className="block">Tipo
              <select value={form.tipoConta} onChange={(e) => setForm({ ...form, tipoConta: e.target.value })} className={inp}>
                <option value="infoprodutor">Infoprodutor</option>
                <option value="corporativo">Corporativo</option>
              </select>
            </label>
            <label className="block">Valor base (R$)<input type="number" step="0.01" value={form.valorBase} onChange={(e) => setForm({ ...form, valorBase: e.target.value })} className={inp} /></label>
            {ehInfo ? (
              <>
                <label className="block">Alunos incluídos<input type="number" value={form.alunosIncluidos} onChange={(e) => setForm({ ...form, alunosIncluidos: e.target.value })} className={inp} /></label>
                <label className="block">Valor por excedente (R$)<input type="number" step="0.01" value={form.valorPorExcedente} onChange={(e) => setForm({ ...form, valorPorExcedente: e.target.value })} className={inp} /></label>
              </>
            ) : (
              <label className="block">Limite de assentos<input type="number" value={form.limiteUsuarios} onChange={(e) => setForm({ ...form, limiteUsuarios: e.target.value })} className={inp} /></label>
            )}
          </div>
          <button className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Criar plano</button>
        </form>

        <div className="ui-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
              <tr><th className="px-4 py-2 font-medium">Plano</th><th className="px-4 py-2 font-medium">Tipo</th><th className="px-4 py-2 font-medium">Base</th><th className="px-4 py-2 font-medium">Incluídos / Assentos</th><th className="px-4 py-2 font-medium">Excedente</th><th className="px-4 py-2 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {planos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Nenhum plano no catálogo.</td></tr>
              ) : planos.map((p) => (
                <tr key={p.id} className={p.ativo ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">{p.nome}<br /><span className="text-xs text-slate-400">{p.slug}</span></td>
                  <td className="px-4 py-3">{p.tipoConta}</td>
                  <td className="px-4 py-3">R$ {Number(p.valorBase).toFixed(2)}</td>
                  <td className="px-4 py-3">{p.tipoConta === 'infoprodutor' ? `${p.alunosIncluidos ?? 0} alunos` : `${p.limiteUsuarios ?? 0} assentos`}</td>
                  <td className="px-4 py-3">{p.valorPorExcedente != null ? `R$ ${Number(p.valorPorExcedente).toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => alternarAtivo(p)} className={`text-xs px-2 py-0.5 rounded-full ${p.ativo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                      {p.ativo ? 'ativo' : 'inativo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
