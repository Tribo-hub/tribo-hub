'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, clearToken } from '../lib/api';

type Item = { href: string; label: string; icon: string };

const INFO: Item[] = [
  { href: '/painel/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/painel/conteudo', label: 'Conteúdo', icon: '🎬' },
  { href: '/painel/ofertas', label: 'Ofertas & Integração', icon: '🔌' },
  { href: '/painel/matriculas', label: 'Matrículas', icon: '🎟️' },
  { href: '/painel/marca', label: 'Marca', icon: '🎨' },
];
const CORP: Item[] = [
  { href: '/painel/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/painel/equipe', label: 'Equipe', icon: '👥' },
  { href: '/painel/marca', label: 'Marca', icon: '🎨' },
];
const ADMIN: Item[] = [
  { href: '/admin/contas', label: 'Contas', icon: '🛡️' },
  { href: '/admin/conteudo', label: 'Catálogo', icon: '🎬' },
  { href: '/admin/faturamento', label: 'Faturamento', icon: '💳' },
  { href: '/admin/menu', label: 'Atalhos do menu', icon: '⚙️' },
];

type LinkExterno = { id: string; nome: string; url: string };

export function Sidebar({ area }: { area: 'painel' | 'admin' }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [itens, setItens] = useState<Item[]>(area === 'admin' ? ADMIN : INFO);
  const [marca, setMarca] = useState(area === 'admin' ? 'Super Admin' : 'Tribo Hub');
  const [externos, setExternos] = useState<LinkExterno[]>([]);

  const grupo = area === 'admin' ? 'Super Admin · /admin' : 'Painel · /painel';

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('tribo_nav') === '1');
      setDark(document.documentElement.classList.contains('dark'));
    } catch {
      /* ignore */
    }
    if (area === 'painel') {
      api<{ conta?: { tipoConta: string; nome: string } }>('/me')
        .then((m) => {
          setItens(m.conta?.tipoConta === 'corporativo' ? CORP : INFO);
          if (m.conta?.nome) setMarca(m.conta.nome);
        })
        .catch(() => {});
    } else {
      api<LinkExterno[]>('/admin/menu-links')
        .then(setExternos)
        .catch(() => {});
    }
  }, [area]);

  function toggleNav() {
    setCollapsed((c) => {
      const n = !c;
      try {
        localStorage.setItem('tribo_nav', n ? '1' : '0');
      } catch {
        /* ignore */
      }
      return n;
    });
  }
  function toggleTheme() {
    const d = document.documentElement.classList.toggle('dark');
    setDark(d);
    try {
      localStorage.setItem('tribo_theme', d ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }
  function sair() {
    clearToken();
    router.replace('/login');
  }

  return (
    <aside
      className={`bg-slate-950 text-slate-300 sticky top-0 h-screen overflow-y-auto flex flex-col shrink-0 transition-[width] duration-200 ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      <div className="p-3 border-b border-slate-800">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-tribo-600 grid place-items-center font-bold text-white shrink-0">
              {marca[0]?.toUpperCase() ?? 'T'}
            </div>
            {!collapsed && <span className="font-semibold text-white whitespace-nowrap truncate">{marca}</span>}
          </div>
          {!collapsed && (
            <button onClick={toggleNav} title="Recolher menu" className="text-slate-400 hover:text-white text-lg leading-none">
              «
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={toggleNav} title="Expandir menu" className="w-full mt-1 text-slate-400 hover:text-white text-lg">
            »
          </button>
        )}
      </div>

      <nav className="p-2 space-y-1 text-sm flex-1">
        {!collapsed && <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2 pt-2 pb-1">{grupo}</p>}
        {itens.map((i) => {
          const on = pathname?.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              title={i.label}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed ? 'justify-center' : ''} ${
                on ? 'bg-tribo-600 text-white' : 'hover:bg-slate-800'
              }`}
            >
              <span>{i.icon}</span>
              {!collapsed && <span className="whitespace-nowrap">{i.label}</span>}
            </Link>
          );
        })}

        {area === 'admin' && externos.length > 0 && (
          <>
            {!collapsed && <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2 pt-3 pb-1">Atalhos</p>}
            {externos.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                title={l.nome}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
              >
                <span>🔗</span>
                {!collapsed && <span className="whitespace-nowrap truncate">{l.nome}</span>}
              </a>
            ))}
          </>
        )}
      </nav>

      <div className="p-2 border-t border-slate-800 space-y-1 text-sm">
        <button
          onClick={toggleTheme}
          title="Alternar tema"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
        >
          <span>{dark ? '☀️' : '🌙'}</span>
          {!collapsed && <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>}
        </button>
        <button
          onClick={sair}
          title="Sair"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
        >
          <span>🚪</span>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
