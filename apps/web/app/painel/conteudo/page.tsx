'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  publicado: boolean;
}

const CATEGORIAS = ['vendas', 'lideranca', 'atendimento', 'comunicacao', 'produtividade', 'outros'];

export default function ConteudoPage() {
  const router = useRouter();
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ titulo: '', descricao: '', categoria: 'vendas' });

  const carregar = useCallback(async () => {
    try {
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

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-tribo-600 grid place-items-center text-white text-sm font-bold">T</div>
            <span className="font-semibold">Tribo Hub · Conteúdo</span>
          </div>
          <button
            onClick={() => {
              clearToken();
              router.replace('/login');
            }}
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 grid lg:grid-cols-[1fr_320px] gap-6">
        <section>
          <h1 className="text-xl font-bold mb-4">Minhas trilhas</h1>
          {erro && <p className="text-sm text-rose-600 mb-3">{erro}</p>}
          {carregando ? (
            <p className="text-slate-500">Carregando...</p>
          ) : trilhas.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhuma trilha ainda. Crie a primeira ao lado →</p>
          ) : (
            <div className="space-y-2">
              {trilhas.map((t) => (
                <Link
                  key={t.id}
                  href={`/painel/conteudo/${t.id}`}
                  className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-3 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t.titulo}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        t.publicado
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {t.publicado ? 'publicado' : 'rascunho'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{t.categoria}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 h-fit">
          <h2 className="font-semibold mb-3">Nova trilha</h2>
          <form onSubmit={criar} className="space-y-3">
            <input
              placeholder="Título"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Descrição"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              required
              rows={3}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
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
    </main>
  );
}
