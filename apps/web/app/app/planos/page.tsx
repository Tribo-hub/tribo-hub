'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface PlanoCard {
  id: string;
  titulo: string;
  subtitulo: string | null;
  ordem: number;
  capaUrl: string | null;
  prazoEm: string | null;
  releasedAt: string | null;
  bloqueado: boolean;
  totalItens: number;
  concluidos: number;
  percentual: number;
  analiseAtiva: boolean;
  entregue: boolean;
  entregaStatus: string | null;
  diasAntesDoPrazo: number | null;
  temAnalise: boolean;
}
interface Me { conta?: { corPrimaria: string | null } }

const DIA = 86_400_000;
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');

function countdown(p: PlanoCard): { txt: string; cor: 'normal' | 'alerta' | 'ok' } {
  if (p.entregue) {
    if (p.diasAntesDoPrazo == null) return { txt: 'Entregue', cor: 'ok' };
    if (p.diasAntesDoPrazo >= 0) return { txt: `Entregue com ${p.diasAntesDoPrazo} dia(s) de antecedência`, cor: 'ok' };
    return { txt: `Entregue com ${Math.abs(p.diasAntesDoPrazo)} dia(s) de atraso`, cor: 'alerta' };
  }
  if (p.bloqueado) return { txt: `Disponível em ${fmt(p.releasedAt)}`, cor: 'normal' };
  if (!p.prazoEm) return { txt: '', cor: 'normal' };
  const d = Math.ceil((new Date(p.prazoEm).getTime() - Date.now()) / DIA);
  if (d < 0) return { txt: `${Math.abs(d)} dia(s) de atraso`, cor: 'alerta' };
  if (d === 0) return { txt: 'Vence hoje', cor: 'alerta' };
  return { txt: `Faltam ${d} dias`, cor: 'normal' };
}

export default function PlanosAlunoPage() {
  const router = useRouter();
  const [planos, setPlanos] = useState<PlanoCard[]>([]);
  const [cor, setCor] = useState('#7c3aed');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [ps, me] = await Promise.all([api<PlanoCard[]>('/app/planos'), api<Me>('/me')]);
      setPlanos(ps);
      setCor(me.conta?.corPrimaria || '#7c3aed');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  return (
    <main>
      <div className="max-w-5xl mx-auto px-5 py-8">
        <h1 className="text-xl font-bold mb-1">Planos de ação</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Cumpra as tarefas no prazo e entregue o seu plano.</p>

        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : planos.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum plano de ação disponível no momento.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {planos.map((p) => {
              const cd = countdown(p);
              const concluido = p.entregue;
              const Card = (
                <div className={`ui-card overflow-hidden h-full flex flex-col ${p.bloqueado ? 'opacity-80' : 'hover:shadow-md transition'}`}>
                  <div className="relative">
                    {p.capaUrl ? (
                      <img src={p.capaUrl} alt={p.titulo} className="aspect-[2/3] w-full object-cover" />
                    ) : (
                      <div className="aspect-[2/3] grid place-items-center" style={{ background: `linear-gradient(to bottom right, ${cor}, #6366f1)` }}>
                        <span className="text-white/40 text-6xl font-black">#{p.ordem}</span>
                      </div>
                    )}
                    <span className="absolute top-2 left-2 text-[11px] font-bold bg-black/55 text-white px-2 py-0.5 rounded-full">#{p.ordem}</span>
                    {p.bloqueado && (
                      <div className="absolute inset-0 bg-black/55 grid place-items-center text-center px-3">
                        <div className="text-white">
                          <div className="text-3xl">🔒</div>
                          <p className="text-xs mt-1">Disponível em<br />{fmt(p.releasedAt)}</p>
                        </div>
                      </div>
                    )}
                    {concluido && (
                      <span className="absolute top-2 right-2 text-[11px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                        {p.entregaStatus === 'reviewed' || p.temAnalise ? 'Analisado' : 'Entregue'}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    {p.subtitulo && <p className="text-[11px] uppercase tracking-wide text-slate-400">{p.subtitulo}</p>}
                    <h3 className="font-semibold leading-tight">{p.titulo}</h3>
                    <div className="mt-3 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${p.percentual}%`, backgroundColor: cor }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{p.concluidos} de {p.totalItens} concluídas · {p.percentual}%</p>
                    {cd.txt && (
                      <p className={`text-xs mt-2 font-medium ${cd.cor === 'alerta' ? 'text-rose-500' : cd.cor === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {cd.cor === 'ok' ? '✓ ' : '⏰ '}{cd.txt}
                      </p>
                    )}
                    {concluido && p.analiseAtiva && (
                      <p className="text-xs mt-2 font-medium" style={{ color: cor }}>
                        {p.temAnalise ? 'Ver análise do mentor →' : 'Aguardando análise do mentor'}
                      </p>
                    )}
                  </div>
                </div>
              );
              return p.bloqueado ? (
                <div key={p.id}>{Card}</div>
              ) : (
                <Link key={p.id} href={`/app/planos/ver?id=${p.id}`}>{Card}</Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
