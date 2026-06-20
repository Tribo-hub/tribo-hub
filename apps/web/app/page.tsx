'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('tribo_theme') === 'dark';
    setDark(saved);
    document.documentElement.classList.toggle('dark', saved);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('tribo_theme', next ? 'dark' : 'light');
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-tribo-600 grid place-items-center text-white text-3xl font-bold">
          T
        </div>
        <h1 className="text-4xl font-bold">Tribo Hub</h1>
        <p className="text-slate-500 dark:text-slate-400">Fundação no ar — Fase 0 ✓</p>
        <button
          onClick={toggle}
          className="px-5 py-2.5 rounded-xl bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold transition"
        >
          {dark ? '☀️ Modo claro' : '🌙 Modo escuro'}
        </button>
      </div>
    </main>
  );
}
