'use client';

import { useEffect, useState } from 'react';
import { subscribeToasts, dismissToast, type ToastItem } from '../lib/toast';

const ESTILO: Record<string, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
  info: 'bg-slate-800 text-white dark:bg-slate-700',
};
const ICONE: Record<string, string> = { success: '✓', error: '!', info: 'i' };

export function Toaster() {
  const [itens, setItens] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItens), []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
      {itens.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => dismissToast(t.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium cursor-pointer animate-[fadeIn_.2s_ease] ${ESTILO[t.tipo]}`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 grid place-items-center text-xs font-bold shrink-0">{ICONE[t.tipo]}</span>
          <span className="flex-1">{t.texto}</span>
          <span className="opacity-70 text-xs">✕</span>
        </div>
      ))}
    </div>
  );
}
