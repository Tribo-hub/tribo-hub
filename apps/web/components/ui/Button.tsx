'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost';
type Tamanho = 'sm' | 'md';

const VAR: Record<Variante, string> = {
  primary: 'bg-tribo-600 hover:bg-tribo-700 text-white',
  secondary: 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700',
  danger: 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
};
const TAM: Record<Tamanho, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1',
  md: 'text-sm px-4 py-2 rounded-lg gap-2',
};

export function Button({
  variante = 'secondary',
  tamanho = 'sm',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: Tamanho }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-tribo-500 outline-none ${VAR[variante]} ${TAM[tamanho]} ${className}`}
    />
  );
}
