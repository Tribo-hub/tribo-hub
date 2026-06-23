'use client';

import { Sidebar } from './Sidebar';

export function Shell({ area, children }: { area: 'painel' | 'admin'; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <Sidebar area={area} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
