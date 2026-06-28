'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { api } from '../lib/api';
import { Sidebar } from './Sidebar';
import { BloqueioInadimplencia } from './BloqueioInadimplencia';

export function Shell({ area, children }: { area: 'painel' | 'admin'; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    if (area === 'painel') api<{ bloqueado?: boolean }>('/me').then((m) => setBloqueado(!!m.bloqueado)).catch(() => {});
  }, [area]);

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setOpen(false)} />}
      <Sidebar area={area} mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0">
        {/* Topbar mobile */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-950 text-white px-4 h-14">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="p-1">
            <Menu size={22} />
          </button>
          <span className="font-semibold">{area === 'admin' ? 'Super Admin' : 'Tribo Hub'}</span>
        </div>
        {bloqueado ? <BloqueioInadimplencia tipo="produtor" /> : children}
      </div>
    </div>
  );
}
