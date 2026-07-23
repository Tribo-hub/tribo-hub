'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Trilha { id: string; titulo: string }
interface Agente {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  icone: string | null;
  url: string;
  todasTrilhas: boolean;
  trilhaIds: string[];
}

const VAZIO = { nome: '', descricao: '', categoria: '', icone: '🤖', url: '', todasTrilhas: false, trilhaIds: [] as string[] };

export default function AgentesPainelPage() {
  const router = useRouter();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setTrilhas(await api<Trilha[]>('/painel/trilhas'));
      setAgentes(await api<Agente[]>('/painel/agentes'));
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

  function tituloTrilha(id: string) {
    return trilhas.find((t) => t.id === id)?.titulo ?? '—';
  }
  function toggleTrilha(id: string) {
    setForm((f) => ({
      ...f,
      trilhaIds: f.trilhaIds.includes(id) ? f.trilhaIds.filter((x) => x !== id) : [...f.trilhaIds, id],
    }));
  }
  function editar(a: Agente) {
    setEditId(a.id);
    setForm({
      nome: a.nome, descricao: a.descricao ?? '', categoria: a.categoria ?? '',
      icone: a.icone ?? '🤖', url: a.url, todasTrilhas: a.todasTrilhas, trilhaIds: a.trilhaIds,
    });
  }
  function cancelar() {
    setEditId(null);
    setForm(VAZIO);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      if (editId) await api(`/painel/agentes/${editId}`, { method: 'PATCH', body: JSON.stringify(form) });
      else await api('/painel/agentes', { method: 'POST', body: JSON.stringify(form) });
      cancelar();
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este agente?')) return;
    await api(`/painel/agentes/${id}`, { method: 'DELETE' });
    if (editId === id) cancelar();
    await carregar();
  }

  return (
    <Shell area="painel">
      <div className="p-6 grid lg:grid-cols-[1fr_360px] gap-6">
        <section>
          <h1 className="text-2xl font-bold mb-1">Agentes de IA</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            Cadastre links de GPTs/agentes externos e escolha em quais cursos eles aparecem para seus alunos.
          </p>
          {agentes.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum agente ainda. Crie ao lado →</p>
          ) : (
            <div className="space-y-2">
              {agentes.map((a) => (
                <div key={a.id} className="ui-card px-5 py-3 flex items-center gap-3">
                  <span className="text-2xl">{a.icone || '🤖'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.nome}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {a.todasTrilhas ? 'Todas as trilhas' : a.trilhaIds.map(tituloTrilha).join(', ') || 'Nenhuma trilha'}
                    </p>
                  </div>
                  <button onClick={() => editar(a)} className="text-xs text-tribo-600 dark:text-tribo-400">editar</button>
                  <button onClick={() => remover(a.id)} className="text-xs text-rose-500">remover</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="ui-card p-5 h-fit">
          <h2 className="font-semibold mb-3">{editId ? 'Editar agente' : 'Novo agente'}</h2>
          {erro && <p className="text-sm text-rose-600 mb-2">{erro}</p>}
          <form onSubmit={salvar} className="space-y-3">
            <div className="flex gap-2">
              <input value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })} className="w-14 text-center border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-2 text-sm" />
              <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="flex-1 min-w-0 ui-input" />
            </div>
            <input placeholder="Categoria (ex.: Copy)" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full ui-input" />
            <textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="w-full ui-input" />
            <input placeholder="Link (URL do GPT/Claude/...)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required className="w-full ui-input" />

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Aparece em:</p>
              <label className="flex items-center gap-2 text-sm mb-2">
                <input type="checkbox" checked={form.todasTrilhas} onChange={(e) => setForm({ ...form, todasTrilhas: e.target.checked })} />
                Todas as trilhas
              </label>
              {!form.todasTrilhas && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {trilhas.length === 0 ? (
                    <p className="text-xs text-slate-400">Crie trilhas primeiro em Conteúdo.</p>
                  ) : trilhas.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.trilhaIds.includes(t.id)} onChange={() => toggleTrilha(t.id)} />
                      {t.titulo}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button disabled={salvando} className="flex-1 bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg text-sm">{salvando ? '...' : editId ? 'Salvar' : 'Criar agente'}</button>
              {editId && <button type="button" onClick={cancelar} className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600">Cancelar</button>}
            </div>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
