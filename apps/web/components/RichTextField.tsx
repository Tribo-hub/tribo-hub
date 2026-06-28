'use client';

import { useEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '../lib/sanitize';

// Campo de conteúdo rico: mostra um preview (altura fixa, rola se exceder) e,
// ao clicar, abre um modal de edição com barra de formatação (negrito, fonte,
// tamanho, cor, listas, alinhamento, link, etc).
// Comprimento do texto puro (sem tags) — usado para o limite de caracteres.
function textoLen(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').trim().length;
}

export function RichTextField({
  value,
  onChange,
  placeholder = 'Conteúdo em texto (opcional)',
  maxLength,
  alturaPreview = 'h-[320px]',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
  alturaPreview?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`w-full text-left border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 overflow-y-auto ${alturaPreview}`}
      >
        {value ? (
          <div
            className="prose-conteudo text-sm text-slate-700 dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
          />
        ) : (
          <span className="text-xs text-slate-400">{placeholder} — clique para editar</span>
        )}
      </button>
      {maxLength != null && (
        <p className={`text-[11px] mt-1 text-right ${textoLen(value) > maxLength ? 'text-rose-500' : 'text-slate-400'}`}>
          {textoLen(value)}/{maxLength} caracteres
        </p>
      )}
      {aberto && (
        <EditorModal
          value={value}
          maxLength={maxLength}
          onClose={() => setAberto(false)}
          onSave={(html) => {
            onChange(html);
            setAberto(false);
          }}
        />
      )}
    </>
  );
}

function EditorModal({
  value,
  maxLength,
  onClose,
  onSave,
}: {
  value: string;
  maxLength?: number;
  onClose: () => void;
  onSave: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '';
      setLen(ref.current.textContent?.trim().length ?? 0);
    }
    // estilos inline para cor/tamanho via execCommand
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      /* ignore */
    }
  }, [value]);

  const excedeu = maxLength != null && len > maxLength;

  // Executa um comando mantendo a seleção (mousedown preventDefault evita perder o foco).
  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
  }

  const btn =
    'px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm';
  const sel =
    'border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-1 py-1 text-xs text-slate-700 dark:text-slate-200';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Conteúdo em texto</p>
        </div>

        {/* Barra de ferramentas */}
        <div
          className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-700"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" className={btn} title="Desfazer" onClick={() => exec('undo')}>↶</button>
          <button type="button" className={btn} title="Refazer" onClick={() => exec('redo')}>↷</button>
          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          <select
            className={sel}
            title="Estilo"
            defaultValue="p"
            onChange={(e) => exec('formatBlock', e.target.value)}
          >
            <option value="p">Parágrafo</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
            <option value="blockquote">Citação</option>
          </select>

          <select className={sel} title="Fonte" defaultValue="" onChange={(e) => exec('fontName', e.target.value)}>
            <option value="">Fonte</option>
            <option value="Arial, sans-serif">Sans</option>
            <option value="Georgia, serif">Serif</option>
            <option value="'Courier New', monospace">Mono</option>
          </select>

          <select className={sel} title="Tamanho" defaultValue="" onChange={(e) => exec('fontSize', e.target.value)}>
            <option value="">Tamanho</option>
            <option value="1">Muito pequeno</option>
            <option value="2">Pequeno</option>
            <option value="3">Normal</option>
            <option value="4">Médio</option>
            <option value="5">Grande</option>
            <option value="6">Muito grande</option>
            <option value="7">Enorme</option>
          </select>

          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button type="button" className={`${btn} font-bold`} title="Negrito" onClick={() => exec('bold')}>B</button>
          <button type="button" className={`${btn} italic`} title="Itálico" onClick={() => exec('italic')}>I</button>
          <button type="button" className={`${btn} underline`} title="Sublinhado" onClick={() => exec('underline')}>U</button>
          <button type="button" className={`${btn} line-through`} title="Tachado" onClick={() => exec('strikeThrough')}>S</button>

          <label className={`${btn} cursor-pointer`} title="Cor do texto">
            A
            <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => exec('foreColor', e.target.value)} />
          </label>
          <label className={`${btn} cursor-pointer`} title="Realce">
            🖍
            <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => exec('hiliteColor', e.target.value)} />
          </label>

          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button type="button" className={btn} title="Lista" onClick={() => exec('insertUnorderedList')}>• Lista</button>
          <button type="button" className={btn} title="Lista numerada" onClick={() => exec('insertOrderedList')}>1. Lista</button>

          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button type="button" className={btn} title="Alinhar à esquerda" onClick={() => exec('justifyLeft')}>⬅</button>
          <button type="button" className={btn} title="Centralizar" onClick={() => exec('justifyCenter')}>⬌</button>
          <button type="button" className={btn} title="Alinhar à direita" onClick={() => exec('justifyRight')}>➡</button>

          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            type="button"
            className={btn}
            title="Inserir link"
            onClick={() => {
              const url = window.prompt('URL do link:');
              if (url) exec('createLink', url);
            }}
          >
            🔗
          </button>
          <button type="button" className={btn} title="Limpar formatação" onClick={() => exec('removeFormat')}>✗ formato</button>
        </div>

        {/* Área editável */}
        <div className="flex-1 overflow-y-auto p-4">
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onInput={() => setLen(ref.current?.textContent?.trim().length ?? 0)}
            className="prose-conteudo min-h-[300px] outline-none text-sm text-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          {maxLength != null && (
            <span className={`text-xs mr-auto ${excedeu ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
              {len}/{maxLength} caracteres{excedeu ? ' — acima do limite' : ''}
            </span>
          )}
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2">
            Cancelar
          </button>
          <button
            type="button"
            disabled={excedeu}
            onClick={() => onSave(sanitizeHtml(ref.current?.innerHTML ?? ''))}
            className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
