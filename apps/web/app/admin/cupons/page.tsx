'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { toast } from '../../../lib/toast';

interface Cupom {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: 'percentual' | 'fixo';
  valor: string;
  tipoConta: 'infoprodutor' | 'corporativo' | null;
  duracaoMeses: number | null;
  maxUsos: number | null;
  usos: number;
  validoAte: string | null;
  ativo: boolean;
}

const vazio = { codigo: '', descricao: '', tipo: 'percentual', valor: '', tipoConta: '', duracaoMeses: '', maxUsos: '', validoAte: '' };

export default function CuponsPage() {
  const router = useRouter();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [form, setForm] = useState({ ...vazio });

  const carregar = useCallback(async () => {
    try { setCupons(await api<Cupom[]>('/admin/cupons')); }
    catch (err) { if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); } }
  }, [router]);

  useEffect(() => { if (!getToken()) { router.replace('/login'); return; } carregar(); }, [router, carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.codigo.trim() || !form.valor) { toast.error('Preencha código e valor.'); return; }
    try {
      await api('/admin/cupons', {
        method: 'POST',
        body: JSON.stringify({
          codigo: form.codigo.trim(),
          tipo: form.tipo,
          valor: Number(form.valor),
          descricao: form.descricao.trim() || undefined,
          tipoConta: form.tipoConta || null,
          duracaoMeses: form.duracaoMeses ? Number(form.duracaoMeses) : null,
          maxUsos: form.maxUsos ? Number(form.maxUsos) : null,
          validoAte: form.validoAte || null,
        }),
      });
      setForm({ ...vazio });
      toast.success('Cupom criado.');
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao criar'); }
  }

  async function alternarAtivo(c: Cupom) {
    try {
      if (c.ativo) { await api(`/admin/cupons/${c.id}`, { method: 'DELETE' }); }
      else { await api(`/admin/cupons/${c.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: true }) }); }
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  const inp = 'w-full mt-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm';

  return (
    <Shell area="admin">
      <div className="p-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cupons</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Descontos aplicados no autoatendimento (checkout) ou em qualquer assinatura.</p>
        </div>

        <form onSubmit={criar} className="ui-card p-5 space-y-3">
          <h2 className="font-semibold">Novo cupom</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <label className="block">Código<input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} placeholder="BEMVINDO20" className={inp} /></label>
            <label className="block">Tipo
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inp}>
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Fixo (R$)</option>
              </select>
            </label>
            <label className="block">Valor<input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={inp} /></label>
            <label className="block">Tipo de conta
              <select value={form.tipoConta} onChange={(e) => setForm({ ...form, tipoConta: e.target.value })} className={inp}>
                <option value="">Qualquer</option>
                <option value="infoprodutor">Infoprodutor</option>
                <option value="corporativo">Corporativo</option>
              </select>
            </label>
            <label className="block">Duração (meses)<input type="number" value={form.duracaoMeses} onChange={(e) => setForm({ ...form, duracaoMeses: e.target.value })} placeholder="vazio = sem prazo" className={inp} /></label>
            <label className="block">Máx. usos<input type="number" value={form.maxUsos} onChange={(e) => setForm({ ...form, maxUsos: e.target.value })} placeholder="vazio = ilimitado" className={inp} /></label>
            <label className="block">Válido até<input type="date" value={form.validoAte} onChange={(e) => setForm({ ...form, validoAte: e.target.value })} className={inp} /></label>
            <label className="block sm:col-span-2">Descrição (opcional)<input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inp} /></label>
          </div>
          <button className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Criar cupom</button>
        </form>

        <div className="ui-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
              <tr><th className="px-4 py-2 font-medium">Código</th><th className="px-4 py-2 font-medium">Desconto</th><th className="px-4 py-2 font-medium">Conta</th><th className="px-4 py-2 font-medium">Duração</th><th className="px-4 py-2 font-medium">Usos</th><th className="px-4 py-2 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {cupons.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Nenhum cupom.</td></tr>
              ) : cupons.map((c) => (
                <tr key={c.id} className={c.ativo ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono">{c.codigo}{c.descricao && <><br /><span className="text-xs font-sans text-slate-400">{c.descricao}</span></>}</td>
                  <td className="px-4 py-3">{c.tipo === 'percentual' ? `${Number(c.valor)}%` : `R$ ${Number(c.valor).toFixed(2)}`}</td>
                  <td className="px-4 py-3">{c.tipoConta ?? 'qualquer'}</td>
                  <td className="px-4 py-3">{c.duracaoMeses ? `${c.duracaoMeses} mês(es)` : 'sem prazo'}</td>
                  <td className="px-4 py-3">{c.usos}{c.maxUsos != null ? ` / ${c.maxUsos}` : ''}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => alternarAtivo(c)} className={`text-xs px-2 py-0.5 rounded-full ${c.ativo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                      {c.ativo ? 'ativo' : 'inativo'}
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
