'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Home, CalendarDays, ListChecks, Trophy, Bot, Award,
  Sun, Moon, LogOut, ChevronLeft, ChevronRight, KeyRound, type LucideIcon,
} from 'lucide-react';
import { api, clearToken } from '../lib/api';
import { lerMarca, salvarMarca } from '../lib/marca';
import { SinoNotificacoes } from './SinoNotificacoes';
import { AlterarSenhaModal } from './AlterarSenhaModal';

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

interface Me {
  nome: string;
  avatarUrl?: string | null;
  conta?: {
    nome: string;
    corPrimaria: string | null;
    logoUrl: string | null;
    agendaAtiva?: boolean;
    planosAtivos?: boolean;
    gamificacaoAtiva?: boolean;
  };
}

// Menu lateral white-label da área do aluno (mesmo padrão do painel/admin).
export function AlunoSidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  // Inicia com a marca em cache (evita o "flash" da marca padrão no login).
  const [me, setMe] = useState<Me | null>(() => {
    const c = lerMarca();
    return c ? ({ nome: '', conta: { nome: c.nome, corPrimaria: c.corPrimaria, logoUrl: c.logoUrl } } as Me) : null;
  });

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('tribo_nav') === '1');
      setDark(document.documentElement.classList.contains('dark'));
    } catch { /* ignore */ }
    api<Me>('/me').then((m) => { setMe(m); salvarMarca(m.conta); }).catch(() => {});
  }, []);

  function toggleNav() {
    setCollapsed((c) => {
      const n = !c;
      try { localStorage.setItem('tribo_nav', n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });
  }
  function toggleTheme() {
    const d = document.documentElement.classList.toggle('dark');
    setDark(d);
    try { localStorage.setItem('tribo_theme', d ? 'dark' : 'light'); } catch { /* ignore */ }
  }
  function sair() {
    clearToken();
    router.replace('/login');
  }

  const temMarca = !!me?.conta?.nome;
  const cor = me?.conta?.corPrimaria || (temMarca ? '#7c3aed' : '#334155');
  const marca = me?.conta?.nome || '';
  const iniciais = (me?.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const itens: Item[] = [
    { href: '/app', label: 'Início', icon: Home, exact: true },
    ...(me?.conta?.agendaAtiva ? [{ href: '/app/agenda', label: 'Agenda', icon: CalendarDays }] : []),
    ...(me?.conta?.planosAtivos ? [{ href: '/app/planos', label: 'Planos', icon: ListChecks }] : []),
    ...(me?.conta?.gamificacaoAtiva ? [{ href: '/app/conquistas', label: 'Conquistas', icon: Trophy }] : []),
    { href: '/app/agentes', label: 'Agentes IA', icon: Bot },
    { href: '/app/certificados', label: 'Certificados', icon: Award },
  ];

  return (
    <>
    <aside
      className={`bg-slate-950 text-slate-300 h-screen flex flex-col shrink-0 z-50 w-64
        fixed top-0 left-0 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:sticky md:translate-x-0 ${collapsed ? 'md:w-[4.5rem]' : 'md:w-64'}`}
    >
      <div className="p-3 border-b border-slate-800">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/app" onClick={onClose} className="flex items-center gap-2 overflow-hidden">
            {me?.conta?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.conta.logoUrl} alt={marca} className="w-8 h-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg grid place-items-center font-bold text-white shrink-0" style={{ backgroundColor: cor }}>
                {temMarca ? (marca[0]?.toUpperCase() ?? 'T') : ''}
              </div>
            )}
            {!collapsed && (temMarca
              ? <span className="font-semibold text-white whitespace-nowrap truncate">{marca}</span>
              : <span className="h-4 w-24 rounded bg-slate-700 animate-pulse" />)}
          </Link>
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

      <nav className="p-2 space-y-1 text-sm flex-1 overflow-y-auto">
        {itens.map((i) => {
          const on = i.exact ? pathname === i.href : pathname === i.href || pathname?.startsWith(i.href + '/');
          const Ic = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              title={i.label}
              onClick={onClose}
              style={on ? { backgroundColor: cor, color: '#fff' } : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg outline-none ${collapsed ? 'justify-center' : ''} ${
                on ? '' : 'hover:bg-slate-800'
              }`}
            >
              <Ic size={18} className="shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{i.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-slate-800 space-y-1 text-sm">
        {/* Perfil do aluno + notificações */}
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <Link
            href="/app/perfil"
            onClick={onClose}
            title="Meu perfil"
            className={`flex items-center gap-2 min-w-0 rounded-lg hover:bg-slate-800 px-2 py-1.5 ${collapsed ? '' : 'flex-1'}`}
          >
            {me?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-700 grid place-items-center text-xs font-semibold text-white shrink-0">{iniciais}</div>
            )}
            {!collapsed && <span className="truncate text-slate-200">{me?.nome ?? 'Meu perfil'}</span>}
          </Link>
          <SinoNotificacoes placement="top-left" />
        </div>
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
