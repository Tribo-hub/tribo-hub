'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setSessao } from '../../lib/api';

interface SignupResponse {
  accessToken: string;
  refreshToken: string;
  usuario: { role: string };
}

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tenant, setTenant] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha.length < 8) {
      setErro('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    setCarregando(true);
    try {
      const res = await api<SignupResponse>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ nome, email, senha, ...(tenant ? { tenant } : {}) }),
      });
      setSessao(res.accessToken, res.refreshToken);
      router.push('/app');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar a conta');
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
        <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Criar conta</h1>

        {erro && (
          <p className="text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg px-3 py-2">{erro}</p>
        )}

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full ui-input dark:text-white mt-1"
          />
        </div>
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
          <label className="text-xs text-slate-500 dark:text-slate-400">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="w-full ui-input dark:text-white mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Código da sua conta</label>
          <input
            type="text"
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            placeholder="ex.: academia-do-trafego"
            className="w-full ui-input dark:text-white mt-1"
          />
          <p className="text-[11px] text-slate-400 mt-1">Informe o código da área de membros onde você vai estudar.</p>
        </div>
        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition"
        >
          {carregando ? 'Criando...' : 'Criar conta'}
        </button>
        <Link href="/login" className="block text-center text-sm text-slate-500 hover:text-tribo-600 dark:hover:text-tribo-400">
          Já tenho conta — entrar
        </Link>
      </form>
    </main>
  );
}
