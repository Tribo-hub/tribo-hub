'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { CopyButton } from '../../../components/CopyButton';
import { toast } from '../../../lib/toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

const PLATAFORMAS: { key: string; label: string; auth: 'header' | 'query'; secretLabel: string }[] = [
  { key: 'hotmart', label: 'Hotmart', auth: 'header', secretLabel: 'hottok / segredo do webhook' },
  { key: 'kiwify', label: 'Kiwify', auth: 'query', secretLabel: 'token / segredo do webhook' },
  { key: 'eduzz', label: 'Eduzz', auth: 'query', secretLabel: 'token / segredo do webhook' },
];

interface Trilha { id: string; titulo: string }
interface TurmaOpt { id: string; nome: string }
interface Oferta {
  id: string;
  nome: string;
  trilhaId: string;
  turmaId: string | null;
  codigoProdutoExterno: string | null;
  tipoAcesso: string;
  duracaoAcessoDias: number | null;
  trilha: { titulo: string };
  turma?: { nome: string } | null;
}

export default function OfertasPage() {
  const router = useRouter();
  const [contaId, setContaId] = useState('');
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [integracoes, setIntegracoes] = useState<string[]>([]);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ trilhaId: '', turmaId: '', nome: '', codigoProdutoExterno: '', tipoAcesso: 'prazo', duracaoAcessoDias: 365 });
  const [turmasOferta, setTurmasOferta] = useState<TurmaOpt[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  function carregarTurmasOferta(trilhaId: string) {
    setTurmasOferta([]);
    if (trilhaId) api<TurmaOpt[]>(`/painel/trilhas/${trilhaId}/turmas`).then(setTurmasOferta).catch(() => {});
  }

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
    if (!webhookSecret) { toast.error('Informe o segredo antes de salvar.'); return; }
    try {
      await api('/painel/integracoes', { method: 'PUT', body: JSON.stringify({ plataforma, webhookSecret }) });
      toast.success(`Integração ${plataforma} salva.`);
      setSecrets((s) => ({ ...s, [plataforma]: '' }));
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  function webhookUrl(plataforma: string, auth: 'header' | 'query') {
    if (!contaId) return '...';
    const base = `${API_BASE}/webhooks/${plataforma}/${contaId}`;
    return auth === 'query' ? `${base}?token=${secrets[plataforma] || 'SEGREDO'}` : base;
  }

  function limparForm() {
    setForm({ trilhaId: '', turmaId: '', nome: '', codigoProdutoExterno: '', tipoAcesso: 'prazo', duracaoAcessoDias: 365 });
    setTurmasOferta([]);
    setEditId(null);
  }

  async function salvarOferta(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...form, turmaId: form.turmaId || null };
      if (editId) {
        await api(`/painel/ofertas/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Oferta atualizada.');
      } else {
        await api('/painel/ofertas', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Oferta criada.');
      }
      limparForm();
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  function editarOferta(o: Oferta) {
    setEditId(o.id);
    setForm({
      trilhaId: o.trilhaId,
      turmaId: o.turmaId ?? '',
      nome: o.nome,
      codigoProdutoExterno: o.codigoProdutoExterno ?? '',
      tipoAcesso: o.tipoAcesso,
      duracaoAcessoDias: o.duracaoAcessoDias ?? 365,
    });
    carregarTurmasOferta(o.trilhaId);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function excluirOferta(o: Oferta) {
    if (!confirm(`Excluir a oferta "${o.nome}"?`)) return;
    try {
      await api(`/painel/ofertas/${o.id}`, { method: 'DELETE' });
      toast.success('Oferta excluída.');
      if (editId === o.id) limparForm();
      await carregar();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro'); }
  }

  return (
    <Shell area="painel">
      <div className="p-6 space-y-8">

        {/* Integrações */}
        <section className="space-y-4">
          <h2 className="font-semibold">Integrações (área de membros via webhook)</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {PLATAFORMAS.map((p) => {
              const conectada = integracoes.includes(p.key);
              return (
                <div key={p.key} className="ui-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{p.label}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${conectada ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>
                      {conectada ? 'conectada' : 'não conectada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">URL do webhook (cole na {p.label}):</p>
                    <CopyButton texto={webhookUrl(p.key, p.auth)} label="Copiar URL" />
                  </div>
                  <code className="block text-xs bg-slate-100 dark:bg-slate-700 rounded px-3 py-2 mb-3 break-all">{webhookUrl(p.key, p.auth)}</code>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      value={secrets[p.key] ?? ''}
                      onChange={(e) => setSecrets((s) => ({ ...s, [p.key]: e.target.value }))}
                      placeholder={p.secretLabel}
                      className="flex-1 min-w-0 ui-input"
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
                  <div key={o.id} className={`bg-white dark:bg-slate-800 rounded-xl border px-5 py-3 ${editId === o.id ? 'border-tribo-400' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{o.nome}</p>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400">{o.tipoAcesso === 'vitalicio' ? 'vitalício' : `${o.duracaoAcessoDias} dias`}</span>
                        <button onClick={() => editarOferta(o)} className="text-xs text-tribo-600 dark:text-tribo-400">editar</button>
                        <button onClick={() => excluirOferta(o)} className="text-xs text-rose-500">excluir</button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">produto #{o.codigoProdutoExterno} → {o.trilha.titulo}{o.turma?.nome && <span className="text-tribo-600"> · 🎓 {o.turma.nome}</span>}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <aside className="ui-card p-5 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{editId ? 'Editar oferta' : 'Nova oferta'}</h3>
              {editId && <button onClick={limparForm} className="text-xs text-slate-500 hover:underline">cancelar</button>}
            </div>
            <form onSubmit={salvarOferta} className="space-y-3">
              <select value={form.trilhaId} onChange={(e) => { setForm({ ...form, trilhaId: e.target.value, turmaId: '' }); carregarTurmasOferta(e.target.value); }} required
                className="w-full ui-input">
                <option value="">Selecione a trilha…</option>
                {trilhas.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
              {turmasOferta.length > 0 && (
                <select value={form.turmaId} onChange={(e) => setForm({ ...form, turmaId: e.target.value })} className="w-full ui-input">
                  <option value="">Turma automática (matrículas abertas no momento da compra)</option>
                  {turmasOferta.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              )}
              <input placeholder="Nome da oferta" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required
                className="w-full ui-input" />
              <input placeholder="Código do produto (Hotmart)" value={form.codigoProdutoExterno} onChange={(e) => setForm({ ...form, codigoProdutoExterno: e.target.value })} required
                className="w-full ui-input" />
              <select value={form.tipoAcesso} onChange={(e) => setForm({ ...form, tipoAcesso: e.target.value })}
                className="w-full ui-input">
                <option value="prazo">Acesso por prazo</option>
                <option value="vitalicio">Vitalício</option>
              </select>
              {form.tipoAcesso === 'prazo' && (
                <input type="number" placeholder="Dias de acesso" value={form.duracaoAcessoDias}
                  onChange={(e) => setForm({ ...form, duracaoAcessoDias: Number(e.target.value) })}
                  className="w-full ui-input" />
              )}
              <button className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2 rounded-lg text-sm">{editId ? 'Salvar alterações' : 'Criar oferta'}</button>
            </form>
          </aside>
        </section>
      </div>
    </Shell>
  );
}
