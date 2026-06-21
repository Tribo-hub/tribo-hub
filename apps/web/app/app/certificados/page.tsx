'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface Certificado {
  id: string;
  codigoVerificacao: string;
  emitidoEm: string;
  trilha: { titulo: string };
}

export default function CertificadosPage() {
  const router = useRouter();
  const [certs, setCerts] = useState<Certificado[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setCerts(await api<Certificado[]>('/me/certificados'));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
        return;
      }
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    carregar();
  }, [router, carregar]);

  async function baixar(id: string) {
    try {
      const res = await api<{ url: string }>(`/me/certificados/${id}/download`);
      window.open(res.url, '_blank');
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/app" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">
            ← Minha área
          </Link>
          <span className="font-semibold">Meus certificados</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : certs.length === 0 ? (
          <p className="text-slate-500 text-sm">Você ainda não concluiu nenhuma trilha.</p>
        ) : (
          <div className="space-y-3">
            {certs.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold">{c.trilha.titulo}</p>
                  <p className="text-xs text-slate-500">
                    Emitido em {new Date(c.emitidoEm).toLocaleDateString('pt-BR')} · código {c.codigoVerificacao.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => baixar(c.id)}
                    className="text-sm bg-tribo-600 hover:bg-tribo-700 text-white font-semibold px-3 py-1.5 rounded-lg"
                  >
                    Baixar PDF
                  </button>
                  <a
                    href={`/verificar/${c.codigoVerificacao}`}
                    className="text-sm text-tribo-600 dark:text-tribo-400 hover:underline"
                  >
                    verificar
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
