'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';
import { Shell } from '../../../../components/Shell';

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

export default function CatalogoEditarPage() {
  const router = useRouter();
  const [id, setId] = useState('');
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);
  const [trilha, setTrilha] = useState<Trilha | null>(null);
  const [erro, setErro] = useState('');
  const [novoModulo, setNovoModulo] = useState('');

  const carregar = useCallback(async () => {
    if (!id) return;
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

  async function mover(tipo: 'modulos' | 'aulas', a: { id: string; ordem: number }, b: { id: string; ordem: number }) {
    try {
      await api(`/painel/${tipo}/${a.id}`, { method: 'PATCH', body: JSON.stringify({ ordem: b.ordem }) });
      await api(`/painel/${tipo}/${b.id}`, { method: 'PATCH', body: JSON.stringify({ ordem: a.ordem }) });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro');
    }
  }

  if (!trilha) {
    return (
      <Shell area="admin">
        <div className="p-6 text-slate-500">{erro || 'Carregando...'}</div>
      </Shell>
    );
  }

  return (
    <Shell area="admin">
      <div className="p-6 max-w-3xl">
        <Link href="/admin/conteudo" className="text-sm text-slate-500 hover:underline">
          ← Catálogo
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
          {trilha.modulos.map((m, mi) => (
            <div key={m.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                <span className="font-semibold">
                  {m.ordem}. {m.titulo}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button disabled={mi === 0} onClick={() => mover('modulos', m, trilha.modulos[mi - 1])} className="disabled:opacity-30 hover:text-tribo-600" title="Subir">↑</button>
                  <button disabled={mi === trilha.modulos.length - 1} onClick={() => mover('modulos', m, trilha.modulos[mi + 1])} className="disabled:opacity-30 hover:text-tribo-600" title="Descer">↓</button>
                  <button onClick={() => call(`/painel/modulos/${m.id}`, { method: 'DELETE' })} className="text-rose-500 hover:underline">remover</button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {m.aulas.map((a, ai) => (
                  <li key={a.id} className="px-5 py-2 flex items-center justify-between">
                    <span>
                      {a.ordem}. {a.titulo}{' '}
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded ml-1">
                        {a.tipoVideo}
                      </span>
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <button disabled={ai === 0} onClick={() => mover('aulas', a, m.aulas[ai - 1])} className="disabled:opacity-30 hover:text-tribo-600" title="Subir">↑</button>
                      <button disabled={ai === m.aulas.length - 1} onClick={() => mover('aulas', a, m.aulas[ai + 1])} className="disabled:opacity-30 hover:text-tribo-600" title="Descer">↓</button>
                      <button onClick={() => call(`/painel/aulas/${a.id}`, { method: 'DELETE' })} className="text-rose-500 hover:underline">remover</button>
                    </div>
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
    </Shell>
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
