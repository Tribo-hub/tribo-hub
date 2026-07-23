'use client';

import type { HTMLAttributes } from 'react';

type Tom = 'neutral' | 'success' | 'danger' | 'warning' | 'brand' | 'info';

const TOM: Record<Tom, string> = {
  neutral: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  brand: 'bg-tribo-100 text-tribo-700 dark:bg-tribo-900/40 dark:text-tribo-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

export function Badge({ tom = 'neutral', className = '', ...props }: HTMLAttributes<HTMLSpanElement> & { tom?: Tom }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full ${TOM[tom]} ${className}`} {...props} />;
}
