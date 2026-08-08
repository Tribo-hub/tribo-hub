'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { toast } from '../../../lib/toast';

interface RegistroDns {
  tipo: string;
  nome: string;
  valor: string;
}
interface StatusDominio {
  disponivel: boolean;
  alvoCname: string | null;
  dominio: string | null;
  status: string;
  sslStatus: string | null;
  registros: RegistroDns[];
  ativo: boolean;
}

export default function DominioPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<StatusDominio | null>(null);
  const [dominio, setDominio] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const s = await api<StatusDominio>('/painel/dominio');
      setEstado(s);
      setDominio(s.dominio ?? '');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    carregar();
  }, [router, carregar]);

  async function salvar() {
    const dom = dominio.trim().toLowerCase();
    if (!/^(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/.test(dom)) {
      toast.error('Domínio inválido. Ex.: area.seudominio.com.br (sem http:// e sem barra).');
      return;
    }
    setSalvando(true);
    try {
      await api('/painel/dominio', { method: 'PUT', body: JSON.stringify({ dominio: dom }) });
      toast.success('Domínio salvo. Agora configure o DNS conforme as instruções abaixo.');
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar o domínio');
    } finally {
      setSalvando(false);
    }
  }

  async function verificar() {
    setVerificando(true);
    try {
      const s = await api<StatusDominio>('/painel/dominio/verificar', { method: 'POST' });
      setEstado(s);
      toast[s.ativo ? 'success' : 'info'](s.ativo ? 'Domínio ativo! 🎉' : 'Ainda propagando — aguarde alguns minutos e verifique de novo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao verificar');
    } finally {
      setVerificando(false);
    }
  }

  async function remover() {
    if (!confirm('Remover o domínio próprio desta conta? Os alunos deixarão de acessar por ele.')) return;
    try {
      await api('/painel/dominio', { method: 'DELETE' });
      toast.success('Domínio removido.');
      setDominio('');
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  const alvo = estado?.alvoCname ?? 'origin.tribohub.com.br';

  return (
    <Shell area="painel">
      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Domínio próprio</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Deixe seus alunos acessarem pelo seu próprio endereço, ex.: <code>area.seudominio.com.br</code>.
          </p>
        </div>

        {estado && !estado.disponivel ? (
          <div className="ui-card p-5 text-sm text-slate-600 dark:text-slate-300">
            <p className="font-semibold mb-1">Em breve</p>
            <p className="text-slate-500 dark:text-slate-400">
              O domínio próprio self-service ainda não está habilitado nesta plataforma. Fale com o suporte para
              configurar o seu.
            </p>
          </div>
        ) : (
          <>
            {/* Cadastro do domínio */}
            <div className="ui-card p-5 space-y-3">
              <p className="font-semibold">Seu domínio</p>
              <div className="flex items-center gap-2 text-sm">
                <input
                  value={dominio}
                  onChange={(e) => setDominio(e.target.value)}
                  placeholder="area.seudominio.com.br"
                  className="flex-1 min-w-0 ui-input"
                />
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Use um subdomínio do seu domínio (ex.: <code>area.</code>, <code>cursos.</code>). Sem <code>http://</code> e sem barra.
              </p>
            </div>

            {/* Status + instruções (quando há domínio salvo) */}
            {estado?.dominio && (
              <div className="ui-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{estado.dominio}</p>
                    <span
                      className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded ${
                        estado.ativo
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {estado.ativo ? 'Ativo' : 'Pendente — configure o DNS'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={verificar}
                      disabled={verificando}
                      className="text-sm font-semibold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                      {verificando ? 'Verificando...' : 'Verificar'}
                    </button>
                    <button
                      onClick={remover}
                      className="text-sm font-semibold px-3 py-2 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                {!estado.ativo && (
                  <div className="text-xs space-y-2">
                    <p className="text-slate-600 dark:text-slate-300 font-semibold">
                      No painel de DNS do seu domínio, crie:
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono">
                      <p>Tipo: CNAME</p>
                      <p>Nome: {estado.dominio}</p>
                      <p>Destino: {alvo}</p>
                    </div>
                    {estado.registros.length > 0 && (
                      <>
                        <p className="text-slate-600 dark:text-slate-300 font-semibold mt-2">
                          E estes registros de validação/SSL:
                        </p>
                        {estado.registros.map((r, i) => (
                          <div
                            key={i}
                            className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono break-all"
                          >
                            <p>Tipo: {r.tipo}</p>
                            <p>Nome: {r.nome}</p>
                            <p>Valor: {r.valor}</p>
                          </div>
                        ))}
                      </>
                    )}
                    <p className="text-slate-400">
                      Após criar os registros, clique em <b>Verificar</b>. A ativação (com SSL) leva de alguns minutos a
                      algumas horas, dependendo do seu provedor de DNS.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
