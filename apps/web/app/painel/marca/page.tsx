'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clearToken, getToken, uploadArquivo } from '../../../lib/api';
import { Shell } from '../../../components/Shell';

interface Me {
  nome: string;
  conta?: { nome: string; corPrimaria: string | null; logoUrl: string | null };
}

export default function MarcaPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [marca, setMarca] = useState('');
  const [cor, setCor] = useState('#7c3aed');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const me = await api<Me>('/me');
      setMarca(me.conta?.nome ?? 'Tribo Hub');
      setCor(me.conta?.corPrimaria || '#7c3aed');
      setLogoUrl(me.conta?.logoUrl ?? null);
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

  async function enviarLogo(file: File) {
    setEnviando(true);
    setMsg('');
    try {
      const path = await uploadArquivo('imagens', file);
      // salva o caminho; o /me devolve uma URL assinada para exibir
      await api('/painel/marca', { method: 'PATCH', body: JSON.stringify({ logoUrl: path }) });
      setMsg('Logo atualizado.');
      await carregar();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao enviar logo');
    } finally {
      setEnviando(false);
    }
  }

  async function salvarCor() {
    setSalvando(true);
    setMsg('');
    try {
      await api('/painel/marca', { method: 'PATCH', body: JSON.stringify({ corPrimaria: cor }) });
      setMsg('Cor salva.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Shell area="painel">
      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Marca</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Logo e cor exibidos na área dos seus alunos e nos certificados.</p>
        </div>
        {msg && <p className="text-sm text-tribo-600 dark:text-tribo-400">{msg}</p>}

        {/* Preview */}
        <div className="rounded-2xl text-white p-6" style={{ background: `linear-gradient(to right, #0f172a, ${cor})` }}>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" className="w-12 h-12 rounded-lg object-cover bg-white/10" />
            ) : (
              <div className="w-12 h-12 rounded-lg grid place-items-center font-bold" style={{ backgroundColor: cor }}>
                {marca[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-bold text-lg">{marca}</p>
              <p className="text-xs opacity-80">Prévia da área de membros</p>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="font-semibold mb-3">Logo</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviarLogo(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={enviando}
            className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {enviando ? 'Enviando...' : 'Enviar logo'}
          </button>
          <p className="text-xs text-slate-400 mt-2">PNG, JPG, WEBP ou SVG. Recomendado quadrado, fundo transparente.</p>
        </div>

        {/* Cor */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="font-semibold mb-3">Cor primária</p>
          <div className="flex items-center gap-3">
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="w-12 h-10 rounded border border-slate-300 dark:border-slate-600" />
            <input
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="w-32 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={salvarCor}
              disabled={salvando}
              className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {salvando ? 'Salvando...' : 'Salvar cor'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
