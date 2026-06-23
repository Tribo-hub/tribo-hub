'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setToken } from '../../lib/api';

interface LoginResponse {
  accessToken: string;
  usuario: { nome: string; role: string };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tenant, setTenant] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function destino(role: string) {
    if (role === 'super_admin') return '/admin/contas';
    if (role === 'admin_tenant') return '/painel/conteudo';
    return '/app';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha, ...(tenant ? { tenant } : {}) }),
      });
      setToken(res.accessToken);
      router.push(destino(res.usuario.role));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-7 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-tribo-600 grid place-items-center text-white font-bold">T</div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">Tribo Hub</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Entrar</h1>

        {erro && (
          <p className="text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Conta (subdomínio) — opcional</label>
          <input
            type="text"
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            placeholder="ex.: academia-do-trafego"
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm mt-1"
          />
          <p className="text-[11px] text-slate-400 mt-1">Alunos/gestores: informe a conta (em produção vem do endereço).</p>
        </div>
        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition"
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
        <Link
          href="/esqueci-senha"
          className="block text-center text-sm text-slate-500 hover:text-tribo-600 dark:hover:text-tribo-400"
        >
          Esqueci minha senha
        </Link>
      </form>
    </main>
  );
}
