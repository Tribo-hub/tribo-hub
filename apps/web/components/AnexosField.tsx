'use client';

import { useRef, useState } from 'react';
import { uploadArquivo } from '../lib/api';

export interface Anexo {
  nome: string;
  path: string;
}

// Campo de materiais complementares: faz upload de arquivos (Supabase Storage)
// e mantém uma lista de { nome, path }.
export function AnexosField({
  value,
  onChange,
  pasta = 'materiais',
}: {
  value: Anexo[];
  onChange: (anexos: Anexo[]) => void;
  pasta?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setEnviando(true);
    try {
      const novos: Anexo[] = [];
      for (const f of files) {
        const path = await uploadArquivo(pasta, f);
        novos.push({ nome: f.name, path });
      }
      onChange([...value, ...novos]);
    } catch {
      alert('Falha ao enviar arquivo.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remover(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">Materiais complementares:</label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : '📎 Anexar arquivo'}
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={aoSelecionar} />
      </div>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="truncate">📄 {a.nome}</span>
              <button type="button" onClick={() => remover(i)} className="text-rose-500 shrink-0">remover</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
