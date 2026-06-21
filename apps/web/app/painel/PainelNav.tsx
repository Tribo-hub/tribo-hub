'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '../../lib/api';

const ITENS = [
  { href: '/painel/conteudo', label: 'Conteúdo' },
  { href: '/painel/ofertas', label: 'Ofertas & Integração' },
  { href: '/painel/matriculas', label: 'Matrículas' },
];

export function PainelNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-tribo-600 grid place-items-center text-white text-sm font-bold">T</div>
            <span className="font-semibold hidden sm:inline">Tribo Hub</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            {ITENS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={
                  pathname?.startsWith(i.href)
                    ? 'text-tribo-600 dark:text-tribo-400 font-medium'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={() => {
            clearToken();
            router.replace('/login');
          }}
          className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
