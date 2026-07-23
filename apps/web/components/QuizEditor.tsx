'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Pergunta {
  id: string;
  pergunta: string;
  _count?: { respostas: number };
}
interface Resposta {
  id: string;
  aluno: string;
  resposta: string;
  data: string;
}

export function QuizEditor({ aulaId }: { aulaId: string }) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [nova, setNova] = useState('');
  const [respostas, setRespostas] = useState<Record<string, Resposta[] | null>>({});
  const cls = 'border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-xs';

  const carregar = useCallback(async () => {
    try {
      setPerguntas(await api<Pergunta[]>(`/painel/aulas/${aulaId}/perguntas`));
    } catch {
      /* ignore */
    }
  }, [aulaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nova.trim()) return;
    await api(`/painel/aulas/${aulaId}/perguntas`, { method: 'POST', body: JSON.stringify({ pergunta: nova }) });
    setNova('');
    await carregar();
  }
  async function remover(id: string) {
    if (!confirm('Remover esta pergunta e todas as respostas dos alunos?')) return;
    await api(`/painel/perguntas/${id}`, { method: 'DELETE' });
    await carregar();
  }
  async function verRespostas(id: string) {
    if (respostas[id]) {
      setRespostas((r) => ({ ...r, [id]: null }));
      return;
    }
    const rs = await api<Resposta[]>(`/painel/perguntas/${id}/respostas`);
    setRespostas((r) => ({ ...r, [id]: rs }));
  }

  return (
    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700 space-y-2">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">🧠 Quiz da aula</p>
      {perguntas.length === 0 && <p className="text-xs text-slate-400">Nenhuma pergunta ainda.</p>}
      {perguntas.map((p) => (
        <div key={p.id} className="text-xs">
          <div className="flex items-center gap-2">
            <span className="flex-1">{p.pergunta}</span>
            <button onClick={() => verRespostas(p.id)} className="text-tribo-600 dark:text-tribo-400">
              {respostas[p.id] ? 'ocultar' : `${p._count?.respostas ?? 0} respostas`}
            </button>
            <button onClick={() => remover(p.id)} className="text-rose-500">remover</button>
          </div>
          {respostas[p.id] && (
            <div className="mt-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-600 space-y-1">
              {respostas[p.id]!.length === 0 ? (
                <p className="text-slate-400">Sem respostas.</p>
              ) : (
                respostas[p.id]!.map((r) => (
                  <p key={r.id} className="text-slate-500 dark:text-slate-400">
                    <b className="text-slate-600 dark:text-slate-300">{r.aluno}:</b> {r.resposta}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      ))}
      <form onSubmit={adicionar} className="flex gap-2 pt-1">
        <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova pergunta..." maxLength={500} className={`flex-1 min-w-0 ${cls}`} />
        <button className="bg-slate-700 dark:bg-slate-600 text-white text-xs px-3 rounded-lg">+ Pergunta</button>
      </form>
    </div>
  );
}
