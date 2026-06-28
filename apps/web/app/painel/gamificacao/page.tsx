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

// Mantém só os 13 campos da config (descarta contaId/updatedAt/personalizada que vêm no GET),
// evitando que o PUT envie campos não permitidos (forbidNonWhitelisted) e falhe ao salvar.
function soConfig(o: Partial<Config>): Config {
  const r = { ...PADRAO };
  (Object.keys(PADRAO) as (keyof Config)[]).forEach((k) => {
    if (o[k] != null) r[k] = Number(o[k]);
  });
  return r;
}

export default function GamificacaoConfigPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config>(PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [trilhas, setTrilhas] = useState<{ id: string; titulo: string }[]>([]);
  const [escopo, setEscopo] = useState<string>('conta'); // 'conta' | trilhaId
  const [personalizada, setPersonalizada] = useState(true);
  const [carregandoCfg, setCarregandoCfg] = useState(true);
  const [snapshot, setSnapshot] = useState('');

  const urlEscopo = (esc: string) => (esc === 'conta' ? '/painel/gamificacao' : `/painel/gamificacao/trilha/${esc}`);

  const carregarConfig = useCallback(async (esc: string) => {
    setCarregandoCfg(true);
    try {
      const c = await api<Partial<Config> & { personalizada?: boolean }>(urlEscopo(esc));
      const limpo = soConfig(c);
      setCfg(limpo);
      setSnapshot(JSON.stringify(limpo));
      setPersonalizada(esc === 'conta' ? true : !!c.personalizada);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken();
        router.replace('/login');
      }
    } finally {
      setCarregandoCfg(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api<{ id: string; titulo: string }[]>('/painel/trilhas').then(setTrilhas).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (getToken()) carregarConfig(escopo);
  }, [escopo, carregarConfig]);

  const sujo = JSON.stringify(cfg) !== snapshot;

  function trocarEscopo(novo: string) {
    if (novo === escopo) return;
    if (sujo && !confirm('Há alterações não salvas que serão perdidas. Trocar mesmo assim?')) return;
    setEscopo(novo);
  }

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
      setSnapshot(JSON.stringify(cfg));
      if (escopo !== 'conta') setPersonalizada(true);
      toast.success(escopo === 'conta' ? 'Configuração padrão salva.' : 'Configuração da trilha salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function resetarParaPadrao() {
    if (escopo === 'conta') return;
    if (!confirm('Remover a configuração própria desta trilha? Ela voltará a usar o padrão da conta.')) return;
    try {
      await api(urlEscopo(escopo), { method: 'DELETE' });
      toast.success('Trilha voltou a usar o padrão da conta.');
      await carregarConfig(escopo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao redefinir');
    }
  }

  const num = 'w-24 ui-input text-right';
  const nomeEscopo = trilhas.find((t) => t.id === escopo)?.titulo ?? 'trilha';

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
          <select value={escopo} onChange={(e) => trocarEscopo(e.target.value)} className="w-full ui-input mt-2 font-medium">
            <option value="conta">⭐ Padrão da conta (todas as trilhas)</option>
            {trilhas.map((t) => <option key={t.id} value={t.id}>📚 Trilha: {t.titulo}</option>)}
          </select>

          {/* Banner do escopo atual — deixa evidente qual config está na tela */}
          <div className={`mt-3 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
            escopo === 'conta'
              ? 'bg-tribo-50 dark:bg-tribo-900/20 text-tribo-800 dark:text-tribo-200'
              : personalizada
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
          }`}>
            <span>{carregandoCfg ? '⏳' : escopo === 'conta' ? '⭐' : personalizada ? '✓' : '↪'}</span>
            <div className="flex-1">
              {carregandoCfg ? (
                <span>Carregando configuração…</span>
              ) : escopo === 'conta' ? (
                <span>Editando o <b>padrão da conta</b> — vale para todas as trilhas sem regra própria.</span>
              ) : personalizada ? (
                <span>Editando a <b>configuração própria</b> da trilha <b>{nomeEscopo}</b>.</span>
              ) : (
                <span>A trilha <b>{nomeEscopo}</b> está <b>herdando o padrão da conta</b>. Ajuste e salve para criar uma regra só dela.</span>
              )}
            </div>
            {escopo !== 'conta' && personalizada && !carregandoCfg && (
              <button onClick={resetarParaPadrao} className="text-xs underline whitespace-nowrap shrink-0">usar padrão da conta</button>
            )}
          </div>
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

        <div className="flex items-center gap-3 sticky bottom-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur py-3 -mx-1 px-1">
          <button onClick={salvar} disabled={salvando || carregandoCfg} className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg">
            {salvando ? 'Salvando...' : escopo === 'conta' ? 'Salvar padrão da conta' : `Salvar configuração da trilha`}
          </button>
          {sujo && !carregandoCfg && <span className="text-xs text-amber-600 font-medium">● alterações não salvas</span>}
        </div>
      </div>
    </Shell>
  );
}
