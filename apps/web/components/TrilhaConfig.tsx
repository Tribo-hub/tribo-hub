'use client';

import { useEffect, useRef, useState } from 'react';
import { api, uploadArquivo, urlAssinada } from '../lib/api';

interface TrilhaCfg {
  id: string;
  capaUrl: string | null;
  exibirComoOferta: boolean;
  ofertaTodosAlunos: boolean;
  ofertaParaTrilhas: string[] | null;
  checkoutUrl: string | null;
  whatsappUrl: string | null;
}
interface TrilhaItem { id: string; titulo: string }

// Configurações de capa (estilo Netflix, 2:3) e de vitrine/oferta da trilha.
export function TrilhaConfig({ trilha, onSaved }: { trilha: TrilhaCfg; onSaved: () => void }) {
  const [capaPath, setCapaPath] = useState<string | null>(trilha.capaUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [exibir, setExibir] = useState(trilha.exibirComoOferta);
  const [todos, setTodos] = useState(trilha.ofertaTodosAlunos);
  const [alvos, setAlvos] = useState<string[]>(trilha.ofertaParaTrilhas ?? []);
  const [checkout, setCheckout] = useState(trilha.checkoutUrl ?? '');
  const [whats, setWhats] = useState(trilha.whatsappUrl ?? '');
  const [trilhas, setTrilhas] = useState<TrilhaItem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<TrilhaItem[]>('/painel/trilhas').then((ts) => setTrilhas(ts.filter((t) => t.id !== trilha.id))).catch(() => {});
  }, [trilha.id]);

  // Preview da capa já salva (caminho do Storage → URL assinada).
  useEffect(() => {
    let vivo = true;
    if (capaPath && !preview) {
      const fonte = capaPath.startsWith('http') ? Promise.resolve(capaPath) : urlAssinada(capaPath);
      fonte.then((u) => { if (vivo) setPreview(u); }).catch(() => {});
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capaPath]);

  async function aoSelecionarCapa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const path = await uploadArquivo('capas', file);
      setCapaPath(path);
      setPreview(URL.createObjectURL(file));
    } catch {
      alert('Falha ao enviar a capa.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function toggleAlvo(id: string) {
    setAlvos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  async function salvar() {
    await api(`/painel/trilhas/${trilha.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        capaUrl: capaPath ?? undefined,
        exibirComoOferta: exibir,
        ofertaTodosAlunos: todos,
        ofertaParaTrilhas: alvos,
        checkoutUrl: checkout,
        whatsappUrl: whats,
      }),
    });
    setSalvo(true);
    onSaved();
  }

  const inp = 'w-full ui-input';

  return (
    <div className="ui-card p-5 mb-6 space-y-5">
      <h2 className="font-semibold">Configurações da trilha</h2>

      {/* Capa */}
      <div className="flex gap-4">
        <div className="w-24 shrink-0">
          <div className="aspect-[4/5] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 grid place-items-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="capa" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🎬</span>
            )}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Capa (estilo Netflix)</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Formato retrato <b>4:5</b> — recomendado <b>800×1000 px</b> (JPG ou PNG).
          </p>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
            className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
            {enviando ? 'Enviando...' : preview ? '🖼 Trocar capa' : '🖼 Enviar capa'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={aoSelecionarCapa} />
        </div>
      </div>

      {/* Vitrine / oferta */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={exibir} onChange={(e) => setExibir(e.target.checked)} />
          Exibir esta trilha como <b>oferta</b> (trancada) para alunos de outras trilhas
        </label>

        {exibir && (
          <div className="pl-6 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
              Mostrar para <b>todos os alunos</b> da conta
            </label>

            {!todos && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Mostrar para alunos das trilhas:</p>
                <div className="flex flex-wrap gap-2">
                  {trilhas.length === 0 && <span className="text-xs text-slate-400">Nenhuma outra trilha.</span>}
                  {trilhas.map((t) => (
                    <button key={t.id} type="button" onClick={() => toggleAlvo(t.id)}
                      className={`text-xs px-2 py-1 rounded-lg border ${alvos.includes(t.id)
                        ? 'bg-tribo-600 text-white border-tribo-600'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                      {alvos.includes(t.id) ? '✓ ' : ''}{t.titulo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Link de checkout (botão Comprar)</label>
              <input value={checkout} onChange={(e) => setCheckout(e.target.value)} placeholder="https://pay.hotmart.com/..." className={inp} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">WhatsApp (link ou número)</label>
              <input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="https://wa.me/5511999999999" className={inp} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={salvar} className="bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">
          Salvar configurações
        </button>
        {salvo && <span className="text-xs text-emerald-500">✓ salvo</span>}
      </div>
    </div>
  );
}
