'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '../../lib/api';
import { useMarcaPublica } from '../../lib/useMarcaPublica';
import { MarcaHeader } from '../../components/MarcaHeader';

function Form() {
  const router = useRouter();
  const { marca } = useMarcaPublica();
  const token = useSearchParams().get('token') ?? '';
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await api('/auth/accept-invite', { method: 'POST', body: JSON.stringify({ token, senha }) });
      setOk(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao ativar');
    }
  }

  if (!token) return <p className="text-rose-600 text-sm">Link de convite inválido.</p>;

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-7 space-y-4">
      <MarcaHeader marca={marca} />
      <h1 className="text-lg font-semibold">Ativar sua conta</h1>
      {ok ? (
        <p className="text-sm text-emerald-600">Conta ativada! Redirecionando para o login…</p>
      ) : (
        <>
          {erro && <p className="text-sm text-rose-600">{erro}</p>}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Defina sua senha (mín. 8 caracteres)</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8}
              className="w-full ui-input mt-1" />
          </div>
          <button
            style={marca?.corPrimaria ? { backgroundColor: marca.corPrimaria } : undefined}
            className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2.5 rounded-lg text-sm"
          >
            Ativar e entrar
          </button>
        </>
      )}
    </form>
  );
}

export default function AceitarConvitePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 px-4">
      <Suspense fallback={<p className="text-slate-500">Carregando…</p>}>
        <Form />
      </Suspense>
    </main>
  );
}
