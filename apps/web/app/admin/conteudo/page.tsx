'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  publicado: boolean;
}

const CATEGORIAS = ['vendas', 'lideranca', 'atendimento', 'comunicacao', 'produtividade', 'outros'];

export default function CatalogoPage() {
  const router = useRouter();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ titulo: '', descricao: '', categoria: 'vendas' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState('');

  const carregar = useCallback(async () => {
    try {
      // super_admin → o backend escopa para proprietarioTipo=plataforma (catálogo global)
      setTrilhas(await api<Trilha[]>('/painel/trilhas'));
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
    try {
      await api('/painel/trilhas', { method: 'POST', body: JSON.stringify(form) });
      setForm({ titulo: '', descricao: '', categoria: 'vendas' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar');
    }
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= trilhas.length) return;
    const arr = [...trilhas];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setTrilhas(arr);
    try {
      await api('/painel/trilhas/reordenar', { method: 'POST', body: JSON.stringify({ ids: arr.map((t) => t.id) }) });
    } catch {
      await carregar();
    }
  }

  async function salvarTitulo(id: string) {
    if (!editTitulo.trim()) return;
    try {
      await api(`/painel/trilhas/${id}`, { method: 'PATCH', body: JSON.stringify({ titulo: editTitulo.trim() }) });
      setEditId(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar título');
    }
  }

  return (
    <Shell area="admin">
      <div className="p-6 grid lg:grid-cols-[1fr_320px] gap-6">
        <section>
          <h1 className="text-2xl font-bold mb-1">Catálogo de plataforma</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            Trilhas produzidas por você, exibidas a todas as contas <b>corporativas</b>.
          </p>
          {erro && <p className="text-sm text-rose-600 mb-3">{erro}</p>}
          {carregando ? (
            <p className="text-slate-500">Carregando...</p>
          ) : trilhas.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhuma trilha no catálogo ainda. Crie a primeira ao lado →</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Use ▲▼ para definir a ordem que os alunos veem. ✏️ edita o título.</p>
              {trilhas.map((t, i) => (
                <div key={t.id} className="ui-card px-3 py-3 flex items-center gap-2">
                  <div className="flex flex-col text-slate-400 shrink-0">
                    <button onClick={() => mover(i, -1)} disabled={i === 0} title="Subir" className="disabled:opacity-25 hover:text-tribo-600 leading-none"><ChevronUp size={16} /></button>
                    <button onClick={() => mover(i, 1)} disabled={i === trilhas.length - 1} title="Descer" className="disabled:opacity-25 hover:text-tribo-600 leading-none"><ChevronDown size={16} /></button>
                  </div>
                  {editId === t.id ? (
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <input autoFocus value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvarTitulo(t.id)} className="flex-1 ui-input text-sm" />
                      <button onClick={() => salvarTitulo(t.id)} className="text-xs bg-tribo-600 hover:bg-tribo-700 text-white font-semibold px-3 py-1.5 rounded-lg">Salvar</button>
                      <button onClick={() => setEditId(null)} className="text-xs text-slate-500">cancelar</button>
                    </div>
                  ) : (
                    <>
                      <Link href={`/admin/conteudo/editar?id=${t.id}`} className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.titulo}</p>
                        <p className="text-xs text-slate-500">{t.categoria}</p>
                      </Link>
                      <button onClick={() => { setEditId(t.id); setEditTitulo(t.titulo); }} title="Editar título" className="text-slate-400 hover:text-tribo-600 shrink-0"><Pencil size={15} /></button>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${t.publicado ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {t.publicado ? 'publicado' : 'rascunho'}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="ui-card p-5 h-fit">
          <h2 className="font-semibold mb-3">Nova trilha (catálogo)</h2>
          <form onSubmit={criar} className="space-y-3">
            <input
              placeholder="Título"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
              className="w-full ui-input"
            />
            <textarea
              placeholder="Descrição"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              required
              rows={3}
              className="w-full ui-input"
            />
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full ui-input"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2 rounded-lg text-sm"
            >
              Criar trilha
            </button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
