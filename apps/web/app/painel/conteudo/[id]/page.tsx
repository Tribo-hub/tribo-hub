'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';

interface Aula {
  id: string;
  titulo: string;
  tipoVideo: string;
  duracaoSegundos: number;
  ordem: number;
}
interface Modulo {
  id: string;
  titulo: string;
  ordem: number;
  aulas: Aula[];
}
interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  publicado: boolean;
  modulos: Modulo[];
}

export default function TrilhaDetalhePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const [trilha, setTrilha] = useState<Trilha | null>(null);
  const [erro, setErro] = useState('');
  const [novoModulo, setNovoModulo] = useState('');

  const carregar = useCallback(async () => {
    try {
      setTrilha(await api<Trilha>(`/painel/trilhas/${id}`));
      setErro('');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    carregar();
  }, [router, carregar]);

  async function call(path: string, opts: RequestInit) {
    try {
      await api(path, opts);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro');
    }
  }

  if (!trilha) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 text-slate-500">
        {erro || 'Carregando...'}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <Link href="/painel/conteudo" className="text-sm text-slate-500 hover:underline">
          ← Voltar
        </Link>

        <div className="flex items-center justify-between mt-3 mb-1">
          <h1 className="text-2xl font-bold">{trilha.titulo}</h1>
          <button
            onClick={() =>
              call(`/painel/trilhas/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ publicado: !trilha.publicado }),
              })
            }
            className={`text-xs px-3 py-1 rounded-full font-medium ${
              trilha.publicado
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {trilha.publicado ? 'publicado' : 'rascunho — publicar'}
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{trilha.descricao}</p>
        {erro && <p className="text-sm text-rose-600 mb-3">{erro}</p>}

        <div className="space-y-4">
          {trilha.modulos.map((m) => (
            <div key={m.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                <span className="font-semibold">
                  {m.ordem}. {m.titulo}
                </span>
                <button
                  onClick={() => call(`/painel/modulos/${m.id}`, { method: 'DELETE' })}
                  className="text-xs text-rose-500 hover:underline"
                >
                  remover
                </button>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {m.aulas.map((a) => (
                  <li key={a.id} className="px-5 py-2 flex items-center justify-between">
                    <span>
                      {a.ordem}. {a.titulo}{' '}
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded ml-1">
                        {a.tipoVideo}
                      </span>
                    </span>
                    <button
                      onClick={() => call(`/painel/aulas/${a.id}`, { method: 'DELETE' })}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>
              <AulaForm
                onAdd={(dto) =>
                  call(`/painel/modulos/${m.id}/aulas`, {
                    method: 'POST',
                    body: JSON.stringify({ ...dto, ordem: m.aulas.length + 1 }),
                  })
                }
              />
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!novoModulo.trim()) return;
            call(`/painel/trilhas/${id}/modulos`, {
              method: 'POST',
              body: JSON.stringify({ titulo: novoModulo, ordem: trilha.modulos.length + 1 }),
            });
            setNovoModulo('');
          }}
          className="mt-5 flex gap-2"
        >
          <input
            placeholder="Novo módulo"
            value={novoModulo}
            onChange={(e) => setNovoModulo(e.target.value)}
            className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <button className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 rounded-lg">
            + Módulo
          </button>
        </form>
      </div>
    </main>
  );
}

function AulaForm({
  onAdd,
}: {
  onAdd: (dto: { titulo: string; tipoVideo: string; videoUrl: string; duracaoSegundos: number }) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [tipoVideo, setTipoVideo] = useState('youtube');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim() || !videoUrl.trim()) return;
        onAdd({ titulo, tipoVideo, videoUrl, duracaoSegundos: 300 });
        setTitulo('');
        setVideoUrl('');
      }}
      className="px-5 py-3 flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-700/30 rounded-b-xl"
    >
      <input
        placeholder="Título da aula"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        className="flex-1 min-w-[140px] border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs"
      />
      <select
        value={tipoVideo}
        onChange={(e) => setTipoVideo(e.target.value)}
        className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs"
      >
        <option value="youtube">youtube</option>
        <option value="vimeo">vimeo</option>
      </select>
      <input
        placeholder="URL do vídeo"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        className="flex-1 min-w-[140px] border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs"
      />
      <button className="bg-slate-700 dark:bg-slate-600 text-white text-xs px-3 rounded-lg">+ Aula</button>
    </form>
  );
}
