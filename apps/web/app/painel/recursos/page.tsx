'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { Switch } from '../../../components/Switch';
import { toast } from '../../../lib/toast';

interface Me {
  conta?: { agendaAtiva?: boolean; planosAtivos?: boolean; gamificacaoAtiva?: boolean };
}

interface Recurso {
  chave: 'agendaAtiva' | 'planosAtivos' | 'gamificacaoAtiva';
  titulo: string;
  descricao: string;
  config?: string;
}

const RECURSOS: Recurso[] = [
  {
    chave: 'agendaAtiva',
    titulo: 'Agenda de eventos ao vivo',
    descricao: 'Exibe para os alunos uma agenda de lives (Zoom/Meet) com botão para entrar.',
    config: '/painel/agenda',
  },
  {
    chave: 'planosAtivos',
    titulo: 'Planos de Ação',
    descricao: 'Listas de tarefas com prazo para acompanhar o progresso dos alunos (accountability).',
    config: '/painel/planos',
  },
  {
    chave: 'gamificacaoAtiva',
    titulo: 'Gamificação',
    descricao: 'Alunos ganham XP por concluir aulas e trilhas, sobem de nível, ganham badges e veem o ranking.',
    config: '/painel/gamificacao',
  },
];

export default function RecursosPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    try {
      const me = await api<Me>('/me');
      setFlags({
        agendaAtiva: me.conta?.agendaAtiva ?? false,
        planosAtivos: me.conta?.planosAtivos ?? false,
        gamificacaoAtiva: me.conta?.gamificacaoAtiva ?? false,
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  async function alternar(chave: string) {
    const novo = !flags[chave];
    setFlags((f) => ({ ...f, [chave]: novo }));
    try {
      await api('/painel/recursos', { method: 'PATCH', body: JSON.stringify({ [chave]: novo }) });
      toast.success(novo ? 'Recurso ativado.' : 'Recurso desativado.');
    } catch (err) {
      setFlags((f) => ({ ...f, [chave]: !novo }));
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  return (
    <Shell area="painel">
      <div className="p-6 max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Recursos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ative ou desative funcionalidades para os seus alunos.</p>
        </div>

        {RECURSOS.map((r) => (
          <div key={r.chave} className="ui-card p-5 flex items-center justify-between">
            <div className="pr-4">
              <p className="font-semibold">{r.titulo}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{r.descricao}</p>
              {r.config && flags[r.chave] && (
                <Link href={r.config} className="text-xs font-medium text-tribo-600 dark:text-tribo-400 mt-2 inline-block">Configurar →</Link>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium ${flags[r.chave] ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {flags[r.chave] ? 'Ativado' : 'Desativado'}
              </span>
              <Switch checked={!!flags[r.chave]} onChange={() => alternar(r.chave)} label={r.titulo} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
