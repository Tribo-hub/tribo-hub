'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { RichTextField } from './RichTextField';
import { AnexosField, type Anexo } from './AnexosField';

export interface AulaEditavel {
  id: string;
  titulo: string;
  tipoVideo: string | null;
  videoUrl: string | null;
  conteudoTexto: string | null;
  liberaAposDias: number;
  anexos: Anexo[] | null;
}

// Edição de uma aula existente (título, vídeo, conteúdo rico, anexos, drip).
export function AulaEditor({ aula, onSaved }: { aula: AulaEditavel; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(aula.titulo);
  const [tipoVideo, setTipoVideo] = useState(aula.tipoVideo ?? 'youtube');
  const [videoUrl, setVideoUrl] = useState(aula.videoUrl ?? '');
  const [conteudoTexto, setConteudoTexto] = useState(aula.conteudoTexto ?? '');
  const [liberaAposDias, setLiberaAposDias] = useState(aula.liberaAposDias ?? 0);
  const [anexos, setAnexos] = useState<Anexo[]>(Array.isArray(aula.anexos) ? aula.anexos : []);
  const [salvo, setSalvo] = useState(false);
  const cls = 'border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs';

  async function salvar() {
    if (!titulo.trim()) return;
    try {
      await api(`/painel/aulas/${aula.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titulo,
          tipoVideo,
          videoUrl: videoUrl || undefined,
          conteudoTexto: conteudoTexto || undefined,
          liberaAposDias,
          anexos,
        }),
      });
      setSalvo(true);
      toast.success('Aula salva.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a aula.');
    }
  }

  return (
    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700 space-y-2">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">✏️ Editar aula</p>
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
        <button type="button" onClick={salvar} className="ml-auto bg-tribo-600 hover:bg-tribo-700 text-white text-xs px-4 py-1.5 rounded-lg">Salvar</button>
        {salvo && <span className="text-xs text-emerald-500">✓</span>}
      </div>
    </div>
  );
}
