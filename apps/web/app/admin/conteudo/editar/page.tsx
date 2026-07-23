'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../../lib/api';
import { Shell } from '../../../../components/Shell';
import { QuizEditor } from '../../../../components/QuizEditor';
import { ComentariosEditor } from '../../../../components/ComentariosEditor';
import { RichTextField } from '../../../../components/RichTextField';
import { AnexosField, type Anexo } from '../../../../components/AnexosField';
import { TrilhaConfig } from '../../../../components/TrilhaConfig';
import { AulaEditor } from '../../../../components/AulaEditor';
import { Pencil, Brain, MessageSquare, ChevronUp, ChevronDown, Trash2, GripVertical } from 'lucide-react';

interface Aula {
  id: string;
  titulo: string;
  tipoVideo: string | null;
  videoUrl: string | null;
  conteudoTexto: string | null;
  liberaAposDias: number;
  anexos: Anexo[] | null;
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
  capaUrl: string | null;
  exibirComoOferta: boolean;
  ofertaTodosAlunos: boolean;
  ofertaParaTrilhas: string[] | null;
  checkoutUrl: string | null;
  whatsappUrl: string | null;
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
  const [quizAberto, setQuizAberto] = useState<string | null>(null);
  const [comentAberto, setComentAberto] = useState<string | null>(null);
  const [editAberto, setEditAberto] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<{ tipo: 'modulos' | 'aulas'; id: string } | null>(null);

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

  async function reordenar(tipo: 'modulos' | 'aulas', lista: { id: string }[], fromId: string, toId: string) {
    if (fromId === toId) return;
    const ids = lista.map((x) => x.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    try {
      for (let i = 0; i < ids.length; i++) {
        await api(`/painel/${tipo}/${ids[i]}`, { method: 'PATCH', body: JSON.stringify({ ordem: i + 1 }) });
      }
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

        <TrilhaConfig trilha={trilha} onSaved={carregar} />

        <div className="space-y-4">
          {trilha.modulos.map((m, mi) => (
            <div
              key={m.id}
              onDragOver={(e) => { if (arrastando?.tipo === 'modulos') e.preventDefault(); }}
              onDrop={() => { if (arrastando?.tipo === 'modulos') reordenar('modulos', trilha.modulos, arrastando.id, m.id); setArrastando(null); }}
              className={`ui-card ${arrastando?.tipo === 'modulos' ? 'ring-1 ring-tribo-300' : ''}`}
            >
              <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                <span className="font-semibold flex items-center gap-2">
                  <span draggable onDragStart={() => setArrastando({ tipo: 'modulos', id: m.id })} onDragEnd={() => setArrastando(null)} title="Arrastar para reordenar" className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"><GripVertical size={16} /></span>
                  {m.ordem}. {m.titulo}
                </span>
                <div className="flex items-center gap-0.5 text-slate-400">
                  <button disabled={mi === 0} onClick={() => mover('modulos', m, trilha.modulos[mi - 1])} title="Subir" className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-tribo-600"><ChevronUp size={16} /></button>
                  <button disabled={mi === trilha.modulos.length - 1} onClick={() => mover('modulos', m, trilha.modulos[mi + 1])} title="Descer" className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-tribo-600"><ChevronDown size={16} /></button>
                  <button onClick={() => { if (confirm(`Remover o módulo "${m.titulo}" e todas as suas aulas? Esta ação não pode ser desfeita.`)) call(`/painel/modulos/${m.id}`, { method: 'DELETE' }); }} title="Remover módulo" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"><Trash2 size={16} /></button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {m.aulas.map((a, ai) => (
                  <li
                    key={a.id}
                    onDragOver={(e) => { if (arrastando?.tipo === 'aulas') e.preventDefault(); }}
                    onDrop={(e) => { if (arrastando?.tipo === 'aulas') { e.stopPropagation(); reordenar('aulas', m.aulas, arrastando.id, a.id); } setArrastando(null); }}
                  >
                    <div className="px-5 py-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span draggable onDragStart={() => setArrastando({ tipo: 'aulas', id: a.id })} onDragEnd={() => setArrastando(null)} title="Arrastar para reordenar" className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"><GripVertical size={14} /></span>
                        <span>
                          {a.ordem}. {a.titulo}{' '}
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded ml-1">
                            {a.tipoVideo}
                          </span>
                        </span>
                      </span>
                      <div className="flex items-center gap-0.5 text-slate-400 shrink-0">
                        <button onClick={() => setEditAberto((q) => (q === a.id ? null : a.id))} title="Editar aula" className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-tribo-600 ${editAberto === a.id ? 'text-tribo-600 bg-slate-100 dark:bg-slate-700' : ''}`}><Pencil size={16} /></button>
                        <button onClick={() => setQuizAberto((q) => (q === a.id ? null : a.id))} title="Quiz" className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-tribo-600 ${quizAberto === a.id ? 'text-tribo-600 bg-slate-100 dark:bg-slate-700' : ''}`}><Brain size={16} /></button>
                        <button onClick={() => setComentAberto((q) => (q === a.id ? null : a.id))} title="Comentários" className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-tribo-600 ${comentAberto === a.id ? 'text-tribo-600 bg-slate-100 dark:bg-slate-700' : ''}`}><MessageSquare size={16} /></button>
                        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <button disabled={ai === 0} onClick={() => mover('aulas', a, m.aulas[ai - 1])} title="Subir" className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-tribo-600"><ChevronUp size={16} /></button>
                        <button disabled={ai === m.aulas.length - 1} onClick={() => mover('aulas', a, m.aulas[ai + 1])} title="Descer" className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-tribo-600"><ChevronDown size={16} /></button>
                        <button onClick={() => { if (confirm(`Remover a aula "${a.titulo}"? Esta ação não pode ser desfeita.`)) call(`/painel/aulas/${a.id}`, { method: 'DELETE' }); }} title="Remover aula" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    {editAberto === a.id && <AulaEditor aula={a} onSaved={() => { setEditAberto(null); carregar(); }} />}
                    {quizAberto === a.id && <QuizEditor aulaId={a.id} />}
                    {comentAberto === a.id && <ComentariosEditor aulaId={a.id} />}
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
            className="flex-1 ui-input"
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
  onAdd: (dto: {
    titulo: string;
    tipoVideo: string;
    videoUrl: string;
    duracaoSegundos: number;
    conteudoTexto?: string;
    liberaAposDias?: number;
    anexos?: Anexo[];
  }) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [tipoVideo, setTipoVideo] = useState('youtube');
  const [conteudoTexto, setConteudoTexto] = useState('');
  const [liberaAposDias, setLiberaAposDias] = useState(0);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const cls = 'border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim() || (!videoUrl.trim() && !conteudoTexto.trim())) return;
        onAdd({ titulo, tipoVideo, videoUrl, duracaoSegundos: 300, conteudoTexto: conteudoTexto || undefined, liberaAposDias, anexos });
        setTitulo('');
        setVideoUrl('');
        setConteudoTexto('');
        setLiberaAposDias(0);
        setAnexos([]);
      }}
      className="px-5 py-3 space-y-2 bg-slate-50 dark:bg-slate-700/30 rounded-b-xl"
    >
      <input placeholder="Título da aula" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={`w-full ${cls}`} />
      <div className="flex gap-2">
        <select value={tipoVideo} onChange={(e) => setTipoVideo(e.target.value)} className={cls}>
          <option value="youtube">youtube</option>
          <option value="vimeo">vimeo</option>
        </select>
        <input placeholder="URL do vídeo (opcional)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={`flex-1 min-w-0 ${cls}`} />
      </div>
      <RichTextField value={conteudoTexto} onChange={setConteudoTexto} />
      <AnexosField value={anexos} onChange={setAnexos} />
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">Liberar após (dias):</label>
        <span
          title="Drip content: a aula só fica disponível para o aluno N dias após o início do acesso dele (matrícula). Use 0 para liberar imediatamente."
          className="cursor-help text-xs w-4 h-4 inline-flex items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
        >
          ?
        </span>
        <input type="number" min={0} value={liberaAposDias} onChange={(e) => setLiberaAposDias(Number(e.target.value))} className={`w-20 ${cls}`} />
        <button className="ml-auto bg-slate-700 dark:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg">+ Aula</button>
      </div>
    </form>
  );
}
