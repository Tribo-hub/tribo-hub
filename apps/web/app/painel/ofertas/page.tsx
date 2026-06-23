'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

const PLATAFORMAS: { key: string; label: string; auth: 'header' | 'query'; secretLabel: string }[] = [
  { key: 'hotmart', label: 'Hotmart', auth: 'header', secretLabel: 'hottok / segredo do webhook' },
  { key: 'kiwify', label: 'Kiwify', auth: 'query', secretLabel: 'token / segredo do webhook' },
  { key: 'eduzz', label: 'Eduzz', auth: 'query', secretLabel: 'token / segredo do webhook' },
];

interface Trilha { id: string; titulo: string }
interface Oferta {
  id: string;
  nome: string;
  codigoProdutoExterno: string | null;
  tipoAcesso: string;
  duracaoAcessoDias: number | null;
  trilha: { titulo: string };
}

export default function OfertasPage() {
  const router = useRouter();
  const [contaId, setContaId] = useState('');
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [integracoes, setIntegracoes] = useState<string[]>([]);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ trilhaId: '', nome: '', codigoProdutoExterno: '', tipoAcesso: 'prazo', duracaoAcessoDias: 365 });

  const carregar = useCallback(async () => {
    try {
      const me = await api<{ contaId: string }>('/me');
      setContaId(me.contaId);
      setTrilhas(await api<Trilha[]>('/painel/trilhas'));
      setOfertas(await api<Oferta[]>('/painel/ofertas'));
      const integ = await api<{ plataforma: string }[]>('/painel/integracoes');
      setIntegracoes(integ.map((i) => i.plataforma));
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

  async function salvarSecret(plataforma: string) {
    const webhookSecret = secrets[plataforma];
    if (!webhookSecret) { setMsg('Informe o segredo antes de salvar.'); return; }
    try {
      await api('/painel/integracoes', { method: 'PUT', body: JSON.stringify({ plataforma, webhookSecret }) });
      setMsg(`Integração ${plataforma} salva.`);
      setSecrets((s) => ({ ...s, [plataforma]: '' }));
      await carregar();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Erro'); }
  }

  function webhookUrl(plataforma: string, auth: 'header' | 'query') {
    if (!contaId) return '...';
    const base = `${API_BASE}/webhooks/${plataforma}/${contaId}`;
    return auth === 'query' ? `${base}?token=${secrets[plataforma] || 'SEGREDO'}` : base;
  }

  async function criarOferta(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/painel/ofertas', { method: 'POST', body: JSON.stringify(form) });
      setForm({ trilhaId: '', nome: '', codigoProdutoExterno: '', tipoAcesso: 'prazo', duracaoAcessoDias: 365 });
      await carregar();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Erro'); }
  }

  return (
    <Shell area="painel">
      <div className="p-6 space-y-8">
        {msg && <p className="text-sm text-tribo-600 dark:text-tribo-400">{msg}</p>}

        {/* Integrações */}
        <section className="space-y-4">
          <h2 className="font-semibold">Integrações (área de membros via webhook)</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {PLATAFORMAS.map((p) => {
              const conectada = integracoes.includes(p.key);
              return (
                <div key={p.key} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{p.label}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${conectada ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                      {conectada ? 'conectada' : 'não conectada'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">URL do webhook (cole na {p.label}):</p>
                  <code className="block text-xs bg-slate-100 dark:bg-slate-700 rounded px-3 py-2 mb-3 break-all">{webhookUrl(p.key, p.auth)}</code>
                  <div className="flex gap-2">
                    <input
                      value={secrets[p.key] ?? ''}
                      onChange={(e) => setSecrets((s) => ({ ...s, [p.key]: e.target.value }))}
                      placeholder={p.secretLabel}
                      className="flex-1 min-w-0 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                    <button onClick={() => salvarSecret(p.key)} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 rounded-lg">Salvar</button>
                  </div>
                  {p.auth === 'query' && (
                    <p className="text-[11px] text-slate-400 mt-2">Salve o segredo e cole a URL acima (com o <code>?token=</code>) na {p.label}.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Ofertas */}
        <section className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <h2 className="text-lg font-bold mb-4">Ofertas</h2>
            {ofertas.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhuma oferta. Crie ao lado →</p>
            ) : (
              <div className="space-y-2">
                {ofertas.map((o) => (
                  <div key={o.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{o.nome}</p>
                      <span className="text-xs text-slate-400">{o.tipoAcesso === 'vitalicio' ? 'vitalício' : `${o.duracaoAcessoDias} dias`}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">produto #{o.codigoProdutoExterno} → {o.trilha.titulo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <aside className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 h-fit">
            <h3 className="font-semibold mb-3">Nova oferta</h3>
            <form onSubmit={criarOferta} className="space-y-3">
              <select value={form.trilhaId} onChange={(e) => setForm({ ...form, trilhaId: e.target.value })} required
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione a trilha…</option>
                {trilhas.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
              <input placeholder="Nome da oferta" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Código do produto (Hotmart)" value={form.codigoProdutoExterno} onChange={(e) => setForm({ ...form, codigoProdutoExterno: e.target.value })} required
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm" />
              <select value={form.tipoAcesso} onChange={(e) => setForm({ ...form, tipoAcesso: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="prazo">Acesso por prazo</option>
                <option value="vitalicio">Vitalício</option>
              </select>
              {form.tipoAcesso === 'prazo' && (
                <input type="number" placeholder="Dias de acesso" value={form.duracaoAcessoDias}
                  onChange={(e) => setForm({ ...form, duracaoAcessoDias: Number(e.target.value) })}
                  className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm" />
              )}
              <button className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2 rounded-lg text-sm">Criar oferta</button>
            </form>
          </aside>
        </section>
      </div>
    </Shell>
  );
}
