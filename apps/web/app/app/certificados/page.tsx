'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { toast } from '../../../lib/toast';

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
  const [cor, setCor] = useState('#7c3aed');
  const [baixando, setBaixando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      api<{ conta?: { corPrimaria: string | null } }>('/me').then((m) => setCor(m.conta?.corPrimaria || '#7c3aed')).catch(() => {});
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
    setBaixando(id);
    try {
      const res = await api<{ url: string }>(`/me/certificados/${id}/download`);
      window.open(res.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar o PDF');
    } finally {
      setBaixando(null);
    }
  }

  return (
    <main>
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
                className="ui-card px-5 py-4 flex items-center justify-between"
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
                    disabled={baixando === c.id}
                    style={{ backgroundColor: cor }}
                    className="text-sm hover:opacity-90 disabled:opacity-60 text-white font-semibold px-3 py-1.5 rounded-lg"
                  >
                    {baixando === c.id ? 'Gerando...' : 'Baixar PDF'}
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
