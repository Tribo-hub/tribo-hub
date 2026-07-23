'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Comentario {
  id: string;
  texto: string;
  autor: string;
  isProdutor: boolean;
  data: string;
  respostas?: Comentario[];
}

export function ComentariosEditor({ aulaId }: { aulaId: string }) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');

  const carregar = useCallback(async () => {
    try {
      setComentarios(await api<Comentario[]>(`/painel/aulas/${aulaId}/comentarios`));
    } catch {
      /* ignore */
    }
  }, [aulaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function responder(respostaAId: string) {
    if (!texto.trim()) return;
    await api(`/painel/aulas/${aulaId}/comentarios`, { method: 'POST', body: JSON.stringify({ texto, respostaAId }) });
    setTexto('');
    setRespondendo(null);
    await carregar();
  }
  async function excluir(id: string) {
    if (!confirm('Excluir este comentário?')) return;
    await api(`/painel/comentarios/${id}`, { method: 'DELETE' });
    await carregar();
  }

  const linha = (c: Comentario, resposta = false) => (
    <div key={c.id} className={resposta ? 'ml-4 pl-3 border-l border-slate-200 dark:border-slate-600' : ''}>
      <p className="text-xs">
        <span className={`font-semibold ${c.isProdutor ? 'text-tribo-600 dark:text-tribo-400' : 'text-slate-700 dark:text-slate-200'}`}>{c.autor}</span>
        {c.isProdutor && <span className="ml-1 text-[10px] bg-tribo-100 dark:bg-tribo-600/30 text-tribo-700 dark:text-tribo-300 px-1.5 py-0.5 rounded">produtor</span>}
        <span className="text-slate-400 ml-2">{new Date(c.data).toLocaleDateString('pt-BR')}</span>
        {!resposta && (
          <button onClick={() => { setRespondendo(respondendo === c.id ? null : c.id); setTexto(''); }} className="text-tribo-600 dark:text-tribo-400 ml-2">responder</button>
        )}
        <button onClick={() => excluir(c.id)} className="text-rose-500 ml-2">excluir</button>
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-0.5">{c.texto}</p>
    </div>
  );

  return (
    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700 space-y-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">💬 Comentários da aula</p>
      {comentarios.length === 0 && <p className="text-xs text-slate-400">Nenhum comentário ainda.</p>}
      {comentarios.map((c) => (
        <div key={c.id} className="space-y-1">
          {linha(c)}
          {c.respostas?.map((r) => linha(r, true))}
          {respondendo === c.id && (
            <div className="ml-4 flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') responder(c.id); }}
                placeholder="Responder como produtor..."
                maxLength={2000}
                autoFocus
                className="flex-1 min-w-0 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs"
              />
              <button onClick={() => responder(c.id)} className="bg-tribo-600 text-white text-xs px-3 rounded-lg">Responder</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
