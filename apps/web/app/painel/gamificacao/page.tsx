'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { toast } from '../../../lib/toast';

interface Config {
  xpAula: number; xpTrilha: number; xpPlanoItem: number;
  xpQuiz: number; xpAvaliacao: number; xpComentario: number;
  xpPorNivel: number;
  badgeAulas1: number; badgeAulas2: number; badgeAulas3: number;
  badgeCert1: number; badgeCert2: number; badgeNivel: number;
}

const PADRAO: Config = {
  xpAula: 10, xpTrilha: 100, xpPlanoItem: 5, xpQuiz: 0, xpAvaliacao: 0, xpComentario: 0, xpPorNivel: 200,
  badgeAulas1: 1, badgeAulas2: 10, badgeAulas3: 50, badgeCert1: 1, badgeCert2: 3, badgeNivel: 5,
};

const ACOES: { campo: keyof Config; label: string; desc: string }[] = [
  { campo: 'xpAula', label: 'Concluir uma aula', desc: 'cada aula concluída' },
  { campo: 'xpTrilha', label: 'Concluir uma trilha', desc: 'ao finalizar o curso (certificado)' },
  { campo: 'xpPlanoItem', label: 'Concluir tarefa de plano', desc: 'cada item de Plano de Ação' },
  { campo: 'xpQuiz', label: 'Responder o quiz', desc: '1x por aula' },
  { campo: 'xpAvaliacao', label: 'Avaliar uma aula', desc: 'dar estrelas na aula' },
  { campo: 'xpComentario', label: 'Comentar', desc: '1x por aula' },
];

const BADGES: { campo: keyof Config; icone: string; nome: string; unidade: string }[] = [
  { campo: 'badgeAulas1', icone: '👣', nome: 'Primeiros passos', unidade: 'aulas concluídas na trilha' },
  { campo: 'badgeAulas2', icone: '🏃', nome: 'Maratonista', unidade: 'aulas concluídas na trilha' },
  { campo: 'badgeAulas3', icone: '🔥', nome: 'Dedicado', unidade: 'aulas concluídas na trilha' },
  { campo: 'badgeNivel', icone: '⭐', nome: 'Nível alto', unidade: 'nível alcançado na trilha' },
];
// Obs.: o badge "Trilha concluída" 🎓 é automático (ao emitir o certificado da trilha).

type PresetKey = 'equilibrado' | 'conclusao' | 'comunidade';
const PRESETS: Record<PresetKey, { nome: string; valores: Partial<Config> }> = {
  equilibrado: { nome: 'Equilibrado', valores: { xpAula: 10, xpTrilha: 100, xpPlanoItem: 5, xpQuiz: 5, xpAvaliacao: 5, xpComentario: 5, xpPorNivel: 200 } },
  conclusao: { nome: 'Foco em conclusão', valores: { xpAula: 15, xpTrilha: 200, xpPlanoItem: 5, xpQuiz: 0, xpAvaliacao: 0, xpComentario: 0, xpPorNivel: 300 } },
  comunidade: { nome: 'Foco em comunidade', valores: { xpAula: 10, xpTrilha: 80, xpPlanoItem: 10, xpQuiz: 15, xpAvaliacao: 10, xpComentario: 15, xpPorNivel: 200 } },
};

export default function GamificacaoConfigPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config>(PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [trilhas, setTrilhas] = useState<{ id: string; titulo: string }[]>([]);
  const [escopo, setEscopo] = useState<string>('conta'); // 'conta' | trilhaId

  const urlEscopo = (esc: string) => (esc === 'conta' ? '/painel/gamificacao' : `/painel/gamificacao/trilha/${esc}`);

  const carregarConfig = useCallback(async (esc: string) => {
    try {
      const c = await api<Config>(urlEscopo(esc));
      setCfg({ ...PADRAO, ...c });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api<{ id: string; titulo: string }[]>('/painel/trilhas').then(setTrilhas).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (getToken()) carregarConfig(escopo);
  }, [escopo, carregarConfig]);

  function set(campo: keyof Config, v: number) {
    setCfg((c) => ({ ...c, [campo]: Math.max(0, v || 0) }));
  }
  function aplicarPreset(k: PresetKey) {
    setCfg((c) => ({ ...c, ...PRESETS[k].valores }));
    toast.info(`Preset "${PRESETS[k].nome}" aplicado — revise e salve.`);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api(urlEscopo(escopo), { method: 'PUT', body: JSON.stringify(cfg) });
      toast.success(escopo === 'conta' ? 'Configuração padrão salva.' : 'Configuração da trilha salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  const num = 'w-24 ui-input text-right';

  return (
    <Shell area="painel">
      <div className="p-6 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gamificação</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Pontuação, níveis, badges e ranking são <b>por trilha</b>. Configure o padrão da conta e, se quiser, regras específicas por trilha.</p>
        </div>

        {/* Escopo */}
        <div className="ui-card p-5">
          <label className="text-sm font-medium">Configurar gamificação de:</label>
          <select value={escopo} onChange={(e) => setEscopo(e.target.value)} className="w-full ui-input mt-2">
            <option value="conta">Padrão da conta (todas as trilhas)</option>
            {trilhas.map((t) => <option key={t.id} value={t.id}>Trilha: {t.titulo}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-2">
            {escopo === 'conta'
              ? 'Regra padrão, aplicada às trilhas que não têm configuração própria.'
              : 'Esta trilha usará estes valores (sobrepõe o padrão da conta).'}
          </p>
        </div>

        {/* Presets */}
        <div className="ui-card p-5">
          <p className="font-semibold mb-1">Modelos prontos</p>
          <p className="text-xs text-slate-400 mb-3">Aplique um ponto de partida e ajuste como quiser.</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
              <button key={k} onClick={() => aplicarPreset(k)} className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                {PRESETS[k].nome}
              </button>
            ))}
          </div>
        </div>

        {/* Pontos por ação */}
        <div className="ui-card p-5">
          <p className="font-semibold">Pontos por ação <span className="text-xs font-normal text-slate-400">(0 = desativado)</span></p>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
            {ACOES.map((a) => (
              <div key={a.campo} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-slate-400">{a.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={cfg[a.campo]} onChange={(e) => set(a.campo, Number(e.target.value))} className={num} />
                  <span className="text-xs text-slate-400 w-6">XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nível */}
        <div className="ui-card p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold">XP para subir de nível</p>
            <p className="text-xs text-slate-400">A cada N de XP o aluno avança um nível.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={cfg.xpPorNivel} onChange={(e) => set('xpPorNivel', Number(e.target.value))} className={num} />
            <span className="text-xs text-slate-400 w-6">XP</span>
          </div>
        </div>

        {/* Badges */}
        <div className="ui-card p-5">
          <p className="font-semibold">Badges (conquistas)</p>
          <p className="text-xs text-slate-400 mb-3">Ajuste a quantidade necessária para cada conquista (os troféus são fixos).</p>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {BADGES.map((b) => (
              <div key={b.campo} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{b.icone}</span>
                  <div>
                    <p className="text-sm font-medium">{b.nome}</p>
                    <p className="text-xs text-slate-400">{b.unidade}</p>
                  </div>
                </div>
                <input type="number" min={1} value={cfg[b.campo]} onChange={(e) => set(b.campo, Number(e.target.value))} className={num} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={salvar} disabled={salvando} className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg">
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </div>
    </Shell>
  );
}
