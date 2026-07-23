'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { api, clearToken } from '../lib/api';
import { SinoNotificacoes } from './SinoNotificacoes';

interface Me {
  nome: string;
  conta?: {
    nome: string;
    corPrimaria: string | null;
    logoUrl: string | null;
    agendaAtiva?: boolean;
    planosAtivos?: boolean;
    gamificacaoAtiva?: boolean;
  };
}

type Chave = 'inicio' | 'agenda' | 'planos' | 'conquistas' | 'agentes' | 'certificados';

// Header unificado da área do aluno (white-label) com navegação persistente + menu mobile.
export function AlunoHeader({ active }: { active?: Chave }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [dark, setDark] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    try { setDark(document.documentElement.classList.contains('dark')); } catch { /* ignore */ }
    api<Me>('/me').then(setMe).catch(() => {});
  }, []);

  function toggleTema() {
    const d = document.documentElement.classList.toggle('dark');
    setDark(d);
    try { localStorage.setItem('tribo_theme', d ? 'dark' : 'light'); } catch { /* ignore */ }
  }
  function sair() {
    clearToken();
    router.replace('/login');
  }

  const cor = me?.conta?.corPrimaria || '#7c3aed';
  const marca = me?.conta?.nome || 'Tribo Hub';
  const iniciais = (me?.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const links: { href: string; label: string; chave: Chave }[] = [
    { href: '/app', label: 'Início', chave: 'inicio' },
    ...(me?.conta?.agendaAtiva ? [{ href: '/app/agenda', label: 'Agenda', chave: 'agenda' as Chave }] : []),
    ...(me?.conta?.planosAtivos ? [{ href: '/app/planos', label: 'Planos', chave: 'planos' as Chave }] : []),
    ...(me?.conta?.gamificacaoAtiva ? [{ href: '/app/conquistas', label: 'Conquistas', chave: 'conquistas' as Chave }] : []),
    { href: '/app/agentes', label: 'Agentes IA', chave: 'agentes' },
    { href: '/app/certificados', label: 'Certificados', chave: 'certificados' },
  ];

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/app" className="flex items-center gap-2">
          {me?.conta?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.conta.logoUrl} alt={marca} className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg grid place-items-center text-white font-bold" style={{ backgroundColor: cor }}>
              {marca[0]?.toUpperCase()}
            </div>
          )}
          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">{marca}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-slate-900 dark:hover:text-white" style={active === l.chave ? { color: cor } : undefined}>
              {l.label}
            </Link>
          ))}
          <button onClick={sair} className="hover:text-slate-900 dark:hover:text-white">Sair</button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <SinoNotificacoes />
          <button onClick={toggleTema} title="Alternar tema" aria-label="Alternar tema" className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 grid place-items-center hover:bg-slate-200 dark:hover:bg-slate-600">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center text-sm font-semibold">{iniciais}</div>
          <button onClick={() => setAberto((a) => !a)} aria-label="Menu" className="md:hidden w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 grid place-items-center">
            {aberto ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {aberto && (
        <nav className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 flex flex-col gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setAberto(false)}
              className={`py-2 rounded-lg ${active === l.chave ? 'font-semibold' : 'text-slate-600 dark:text-slate-300'}`}
              style={active === l.chave ? { color: cor } : undefined}>
              {l.label}
            </Link>
          ))}
          <button onClick={sair} className="py-2 text-left text-slate-600 dark:text-slate-300">Sair</button>
        </nav>
      )}
    </header>
  );
}
