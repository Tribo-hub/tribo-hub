'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  linkAcesso: string;
  inicioEm: string;
  duracaoMin: number;
  trilhaTitulo: string | null;
}
interface Me { conta?: { corPrimaria: string | null } }

export default function AgendaAlunoPage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cor, setCor] = useState('#7c3aed');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [evs, me] = await Promise.all([api<Evento[]>('/app/agenda'), api<Me>('/me')]);
      setEventos(evs);
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

  const agora = Date.now();
  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const aoVivo = (ev: Evento) => {
    const ini = new Date(ev.inicioEm).getTime();
    return agora >= ini && agora <= ini + ev.duracaoMin * 60_000;
  };
  const ehHoje = (ev: Evento) => new Date(ev.inicioEm).toDateString() === new Date().toDateString();

  const live = eventos.filter(aoVivo);
  const hoje = eventos.filter((e) => !aoVivo(e) && ehHoje(e));
  const proximos = eventos.filter((e) => !aoVivo(e) && !ehHoje(e));

  const card = (ev: Evento) => {
    const l = aoVivo(ev);
    return (
      <div key={ev.id} className="ui-card p-5 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{ev.titulo}</p>
            {l && <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">AO VIVO</span>}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">📅 {fmt(ev.inicioEm)} · {ev.duracaoMin} min{ev.trilhaTitulo ? ` · ${ev.trilhaTitulo}` : ''}</p>
          {ev.descricao && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{ev.descricao}</p>}
        </div>
        <a href={ev.linkAcesso} target="_blank" rel="noreferrer"
          className="shrink-0 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90"
          style={{ backgroundColor: l ? '#ef4444' : cor }}>
          {l ? 'Entrar agora' : 'Entrar'}
        </a>
      </div>
    );
  };

  const Secao = ({ titulo, itens }: { titulo: string; itens: Evento[] }) =>
    itens.length === 0 ? null : (
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">{titulo}</h3>
        <div className="space-y-3">{itens.map(card)}</div>
      </div>
    );

  return (
    <main>
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : eventos.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum evento ao vivo agendado no momento.</p>
        ) : (
          <>
            <Secao titulo="Ao vivo agora" itens={live} />
            <Secao titulo="Hoje" itens={hoje} />
            <Secao titulo="Próximos" itens={proximos} />
          </>
        )}
      </div>
    </main>
  );
}
