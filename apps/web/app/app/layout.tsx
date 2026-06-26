'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { api } from '../../lib/api';
import { AlunoSidebar } from '../../components/AlunoSidebar';
import { SinoNotificacoes } from '../../components/SinoNotificacoes';

interface Me {
  nome: string;
  conta?: { nome: string };
}

function AlunoTopbar({ onMenu }: { onMenu: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>('/me').then(setMe).catch(() => {}); }, []);
  const marca = me?.conta?.nome || 'Tribo Hub';
  const iniciais = (me?.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-5 h-14">
      <button onClick={onMenu} aria-label="Abrir menu" className="md:hidden p-1 text-slate-600 dark:text-slate-300">
        <Menu size={22} />
      </button>
      <span className="md:hidden font-semibold text-slate-900 dark:text-white truncate">{marca}</span>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <SinoNotificacoes />
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center text-sm font-semibold">{iniciais}</div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // O player é imersivo (tela cheia), sem menu lateral.
  if (pathname?.startsWith('/app/player')) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setOpen(false)} />}
      <AlunoSidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0">
        <AlunoTopbar onMenu={() => setOpen(true)} />
        {children}
      </div>
    </div>
  );
}
