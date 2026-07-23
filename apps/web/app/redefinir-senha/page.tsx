'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha.length < 8) {
      setErro('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (senha !== confirma) {
      setErro('As senhas não conferem.');
      return;
    }
    setCarregando(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, senha }) });
      setOk(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível redefinir');
    } finally {
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

        {ok ? (
          <>
            <h1 className="text-lg font-semibold text-emerald-600">Senha redefinida ✅</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Redirecionando para o login...</p>
          </>
        ) : !token ? (
          <>
            <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Link inválido</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">O link de redefinição está incompleto ou expirou.</p>
            <Link href="/esqueci-senha" className="inline-block text-sm text-tribo-600 dark:text-tribo-400 font-medium">
              Pedir um novo link
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Definir nova senha</h1>
            {erro && (
              <p className="text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg px-3 py-2">{erro}</p>
            )}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Nova senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="w-full ui-input dark:text-white mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Confirmar senha</label>
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
                className="w-full ui-input dark:text-white mt-1"
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition"
            >
              {carregando ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
