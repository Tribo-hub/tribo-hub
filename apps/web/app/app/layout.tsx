'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { api } from '../../lib/api';
import { AlunoSidebar } from '../../components/AlunoSidebar';
import { BloqueioInadimplencia } from '../../components/BloqueioInadimplencia';

interface Me { conta?: { nome: string }; bloqueado?: boolean }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [marca, setMarca] = useState('Tribo Hub');
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    api<Me>('/me').then((m) => { if (m.conta?.nome) setMarca(m.conta.nome); setBloqueado(!!m.bloqueado); }).catch(() => {});
  }, []);

  // O player é imersivo (tela cheia), sem menu lateral.
  if (pathname?.startsWith('/app/player')) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setOpen(false)} />}
      <AlunoSidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0">
        {/* Topo só no mobile: abre o menu lateral */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 h-14">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="p-1 text-slate-600 dark:text-slate-300">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-slate-900 dark:text-white truncate">{marca}</span>
        </div>
        {bloqueado ? <BloqueioInadimplencia tipo="aluno" /> : children}
      </div>
    </div>
  );
}
