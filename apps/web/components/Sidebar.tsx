'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Clapperboard, Cable, Ticket, Calendar, ListChecks, Bot, Palette,
  Puzzle, Users, Shield, CreditCard, Settings, ExternalLink, Sun, Moon, LogOut,
  ChevronLeft, ChevronRight, KeyRound, BarChart3, Handshake, type LucideIcon,
} from 'lucide-react';
import { api, clearToken } from '../lib/api';
import { lerMarca, salvarMarca } from '../lib/marca';
import { AlterarSenhaModal } from './AlterarSenhaModal';

type Item = { href: string; label: string; icon: LucideIcon };

const INFO: Item[] = [
  { href: '/painel/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/painel/conteudo', label: 'Conteúdo', icon: Clapperboard },
  { href: '/painel/ofertas', label: 'Ofertas & Integração', icon: Cable },
  { href: '/painel/matriculas', label: 'Matrículas', icon: Ticket },
  { href: '/painel/agenda', label: 'Agenda', icon: Calendar },
  { href: '/painel/planos', label: 'Planos de Ação', icon: ListChecks },
  { href: '/painel/agentes', label: 'Agentes IA', icon: Bot },
  { href: '/painel/marca', label: 'Marca', icon: Palette },
  { href: '/painel/recursos', label: 'Recursos', icon: Puzzle },
];
const CORP: Item[] = [
  { href: '/painel/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/painel/equipe', label: 'Equipe', icon: Users },
  { href: '/painel/agenda', label: 'Agenda', icon: Calendar },
  { href: '/painel/planos', label: 'Planos de Ação', icon: ListChecks },
  { href: '/painel/agentes', label: 'Agentes IA', icon: Bot },
  { href: '/painel/marca', label: 'Marca', icon: Palette },
  { href: '/painel/assinatura', label: 'Assinatura', icon: CreditCard },
  { href: '/painel/recursos', label: 'Recursos', icon: Puzzle },
];
const ADMIN: Item[] = [
  { href: '/admin/contas', label: 'Contas', icon: Shield },
  { href: '/admin/conteudo', label: 'Catálogo', icon: Clapperboard },
  { href: '/admin/agentes', label: 'Agentes IA', icon: Bot },
  { href: '/admin/financeiro', label: 'Financeiro', icon: BarChart3 },
  { href: '/admin/faturamento', label: 'Faturamento', icon: CreditCard },
  { href: '/admin/planos-catalogo', label: 'Catálogo de planos', icon: Puzzle },
  { href: '/admin/cupons', label: 'Cupons', icon: Ticket },
  { href: '/admin/parceiros', label: 'Parceiros', icon: Handshake },
  { href: '/admin/menu', label: 'Atalhos do menu', icon: Settings },
];

type LinkExterno = { id: string; nome: string; url: string };

export function Sidebar({ area, mobileOpen = false, onClose }: { area: 'painel' | 'admin'; mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [itens, setItens] = useState<Item[]>(area === 'admin' ? ADMIN : INFO);
  // Painel é white-label (marca do tenant); admin é fixo. Seed do cache evita o "flash".
  const [marca, setMarca] = useState(area === 'admin' ? 'Super Admin' : (lerMarca()?.nome || 'Tribo Hub'));
  const [cor, setCor] = useState<string | null>(area === 'admin' ? null : (lerMarca()?.corPrimaria ?? null));
  const [logo, setLogo] = useState<string | null>(area === 'admin' ? null : (lerMarca()?.logoUrl ?? null));
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
      api<{ conta?: { tipoConta: string; nome: string; corPrimaria?: string | null; logoUrl?: string | null } }>('/me')
        .then((m) => {
          setItens(m.conta?.tipoConta === 'corporativo' ? CORP : INFO);
          if (m.conta?.nome) setMarca(m.conta.nome);
          setCor(m.conta?.corPrimaria ?? null);
          setLogo(m.conta?.logoUrl ?? null);
          salvarMarca(m.conta);
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
    <>
    <aside
      className={`bg-slate-950 text-slate-300 h-screen overflow-y-auto flex flex-col shrink-0 z-50 w-64
        fixed top-0 left-0 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:sticky md:translate-x-0 ${collapsed ? 'md:w-[4.5rem]' : 'md:w-64'}`}
    >
      <div className="p-3 border-b border-slate-800">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={marca} className="w-8 h-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div
                className={`w-8 h-8 rounded-lg grid place-items-center font-bold text-white shrink-0 ${cor ? '' : 'bg-tribo-600'}`}
                style={cor ? { backgroundColor: cor } : undefined}
              >
                {marca[0]?.toUpperCase() ?? 'T'}
              </div>
            )}
            {!collapsed && <span className="font-semibold text-white whitespace-nowrap truncate">{marca}</span>}
          </div>
          {!collapsed && (
            <button onClick={toggleNav} title="Recolher menu" aria-label="Recolher menu" className="text-slate-400 hover:text-white">
              <ChevronLeft size={18} />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={toggleNav} title="Expandir menu" aria-label="Expandir menu" className="w-full mt-1 flex justify-center text-slate-400 hover:text-white">
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      <nav className="p-2 space-y-1 text-sm flex-1">
        {!collapsed && <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2 pt-2 pb-1">{grupo}</p>}
        {itens.map((i) => {
          const on = pathname === i.href || pathname?.startsWith(i.href + '/');
          const Ic = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              title={i.label}
              onClick={onClose}
              style={on && cor ? { backgroundColor: cor } : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg focus-visible:ring-2 focus-visible:ring-tribo-500 outline-none ${collapsed ? 'justify-center' : ''} ${
                on ? (cor ? 'text-white' : 'bg-tribo-600 text-white') : 'hover:bg-slate-800'
              }`}
            >
              <Ic size={18} className="shrink-0" />
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
                <ExternalLink size={18} className="shrink-0" />
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
          aria-label="Alternar tema"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
        >
          {dark ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
          {!collapsed && <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>}
        </button>
        <button
          onClick={() => setSenhaAberta(true)}
          title="Alterar senha"
          aria-label="Alterar senha"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
        >
          <KeyRound size={18} className="shrink-0" />
          {!collapsed && <span>Alterar senha</span>}
        </button>
        <button
          onClick={sair}
          title="Sair"
          aria-label="Sair"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
    <AlterarSenhaModal open={senhaAberta} onClose={() => setSenhaAberta(false)} />
    </>
  );
}
