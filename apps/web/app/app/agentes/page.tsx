'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';

interface Agente {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  icone: string | null;
  url: string;
}
interface Me { conta?: { nome: string; corPrimaria: string | null } }

export default function AgentesAlunoPage() {
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [cor, setCor] = useState('#7c3aed');
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [ags, me] = await Promise.all([api<Agente[]>('/app/agentes'), api<Me>('/me')]);
      setAgentes(ags);
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

  const categorias = useMemo(
    () => Array.from(new Set(agentes.map((a) => a.categoria).filter(Boolean))) as string[],
    [agentes],
  );
  const visiveis = agentes.filter(
    (a) =>
      (!cat || a.categoria === cat) &&
      (!busca || a.nome.toLowerCase().includes(busca.toLowerCase()) || (a.descricao ?? '').toLowerCase().includes(busca.toLowerCase())),
  );

  return (
    <main>
      <div className="max-w-6xl mx-auto px-5 py-8">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔎 Buscar agente..."
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm w-60"
          />
          <div className="flex gap-1 flex-wrap text-sm">
            <button onClick={() => setCat(null)} className={`px-3 py-1.5 rounded-lg ${!cat ? 'bg-tribo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>Todos</button>
            {categorias.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg ${cat === c ? 'bg-tribo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>{c}</button>
            ))}
          </div>
        </div>

        {carregando ? (
          <p className="text-slate-500">Carregando...</p>
        ) : visiveis.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum agente disponível {busca || cat ? 'neste filtro' : 'ainda'}.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visiveis.map((a) => (
              <div key={a.id} className="ui-card p-5 flex flex-col">
                <div className="text-3xl">{a.icone || '🤖'}</div>
                {a.categoria && <p className="text-[11px] uppercase tracking-wide mt-2" style={{ color: cor }}>{a.categoria}</p>}
                <p className="font-semibold mt-0.5">{a.nome}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex-1">{a.descricao}</p>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 text-center text-white text-sm font-semibold px-4 py-2 rounded-lg"
                  style={{ backgroundColor: cor }}
                >
                  Abrir ↗
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
