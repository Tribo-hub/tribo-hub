'use client';

import { useState } from 'react';

// Botão de copiar reutilizável (URLs, segredos, Pix copia-e-cola, senhas, etc).
export function CopyButton({ texto, label = 'Copiar', className = '' }: { texto: string; label?: string; className?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // fallback simples
      const el = document.createElement('textarea');
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 ${className}`}
    >
      {copiado ? '✓ copiado' : `⧉ ${label}`}
    </button>
  );
}
