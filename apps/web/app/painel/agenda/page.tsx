'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { toast } from '../../../lib/toast';

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  linkAcesso: string;
  inicioEm: string;
  duracaoMin: number;
  trilhaId: string | null;
  trilhaTitulo: string | null;
}
interface Trilha { id: string; titulo: string }

export default function AgendaProdutorPage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [form, setForm] = useState({ titulo: '', descricao: '', linkAcesso: '', inicioEm: '', duracaoMin: 60, trilhaId: '' });

  const carregar = useCallback(async () => {
    try {
      setEventos(await api<Evento[]>('/painel/eventos'));
      setTrilhas(await api<Trilha[]>('/painel/trilhas'));
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

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.linkAcesso.trim() || !form.inicioEm) return;
    try {
      await api('/painel/eventos', {
        method: 'POST',
        body: JSON.stringify({
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          linkAcesso: form.linkAcesso,
          inicioEm: new Date(form.inicioEm).toISOString(),
          duracaoMin: Number(form.duracaoMin) || 60,
          trilhaId: form.trilhaId || undefined,
        }),
      });
      setForm({ titulo: '', descricao: '', linkAcesso: '', inicioEm: '', duracaoMin: 60, trilhaId: '' });
      toast.success('Evento criado.');
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar evento');
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este evento?')) return;
    await api(`/painel/eventos/${id}`, { method: 'DELETE' });
    await carregar();
  }

  const inp = 'w-full ui-input';
  const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Shell area="painel">
      <div className="p-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agenda de eventos ao vivo</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Lives (Zoom/Meet) que aparecem para os seus alunos. Ative o recurso em “Recursos”.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <section className="ui-card divide-y divide-slate-100 dark:divide-slate-700">
            {eventos.length === 0 ? (
              <p className="p-6 text-center text-slate-400 text-sm">Nenhum evento cadastrado.</p>
            ) : eventos.map((ev) => (
              <div key={ev.id} className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{ev.titulo}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    📅 {fmtData(ev.inicioEm)} · {ev.duracaoMin} min · {ev.trilhaTitulo ? `🎯 ${ev.trilhaTitulo}` : 'todos os alunos'}
                  </p>
                  {ev.descricao && <p className="text-xs text-slate-400 mt-1">{ev.descricao}</p>}
                  <a href={ev.linkAcesso} target="_blank" rel="noreferrer" className="text-xs text-tribo-600 dark:text-tribo-400 break-all">{ev.linkAcesso}</a>
                </div>
                <button onClick={() => remover(ev.id)} className="text-xs text-rose-500 shrink-0">remover</button>
              </div>
            ))}
          </section>

          <aside className="ui-card p-5 h-fit">
            <h3 className="font-semibold mb-3">Novo evento</h3>
            <form onSubmit={criar} className="space-y-3">
              <input placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required className={inp} />
              <textarea placeholder="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className={inp} />
              <input placeholder="Link (Zoom/Meet/YouTube)" value={form.linkAcesso} onChange={(e) => setForm({ ...form, linkAcesso: e.target.value })} required className={inp} />
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Data e hora</label>
                <input type="datetime-local" value={form.inicioEm} onChange={(e) => setForm({ ...form, inicioEm: e.target.value })} required className={inp} />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Duração (min)</label>
                <input type="number" min={1} value={form.duracaoMin} onChange={(e) => setForm({ ...form, duracaoMin: Number(e.target.value) })} className={inp} />
              </div>
              <select value={form.trilhaId} onChange={(e) => setForm({ ...form, trilhaId: e.target.value })} className={inp}>
                <option value="">Todos os alunos</option>
                {trilhas.map((t) => <option key={t.id} value={t.id}>Só alunos de: {t.titulo}</option>)}
              </select>
              <button className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2 rounded-lg text-sm">Criar evento</button>
            </form>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
