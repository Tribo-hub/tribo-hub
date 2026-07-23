'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [tenant, setTenant] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, ...(tenant ? { tenant } : {}) }),
      });
    } catch {
      /* resposta é sempre ok — não revela se o e-mail existe */
    } finally {
      setEnviado(true);
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-7 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-tribo-600 grid place-items-center text-white font-bold">T</div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">Tribo Hub</span>
        </div>

        {enviado ? (
          <>
            <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Verifique seu e-mail</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha (válido por 1 hora).
            </p>
            <Link href="/login" className="inline-block text-sm text-tribo-600 dark:text-tribo-400 font-medium">
              ← Voltar ao login
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Esqueci minha senha</h1>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full ui-input dark:text-white mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Código da sua conta — opcional</label>
              <input
                type="text"
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="ex.: academia-do-trafego"
                className="w-full ui-input dark:text-white mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Aluno ou gestor de uma área de membros? Informe o código da sua conta.</p>
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition"
            >
              {carregando ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
            <Link href="/login" className="block text-center text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">
              ← Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
