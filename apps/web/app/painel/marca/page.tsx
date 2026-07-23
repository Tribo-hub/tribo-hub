'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clearToken, getToken, uploadArquivo } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { RichTextField } from '../../../components/RichTextField';
import { toast } from '../../../lib/toast';

interface Me {
  nome: string;
  conta?: {
    nome: string;
    corPrimaria: string | null;
    logoUrl: string | null;
    boasVindasAtivo?: boolean;
    mensagemBoasVindas?: string | null;
  };
}

export default function MarcaPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [marca, setMarca] = useState('');
  const [cor, setCor] = useState('#7c3aed');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [bvAtivo, setBvAtivo] = useState(false);
  const [bvMsg, setBvMsg] = useState('');
  const [salvandoBv, setSalvandoBv] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const me = await api<Me>('/me');
      setMarca(me.conta?.nome ?? 'Tribo Hub');
      setCor(me.conta?.corPrimaria || '#7c3aed');
      setLogoUrl(me.conta?.logoUrl ?? null);
      setBvAtivo(me.conta?.boasVindasAtivo ?? false);
      setBvMsg(me.conta?.mensagemBoasVindas ?? '');
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
    try {
      const path = await uploadArquivo('imagens', file);
      // salva o caminho; o /me devolve uma URL assinada para exibir
      await api('/painel/marca', { method: 'PATCH', body: JSON.stringify({ logoUrl: path }) });
      toast.success('Logo atualizado.');
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar logo');
    } finally {
      setEnviando(false);
    }
  }

  async function salvarCor() {
    setSalvando(true);
    try {
      await api('/painel/marca', { method: 'PATCH', body: JSON.stringify({ corPrimaria: cor }) });
      toast.success('Cor salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarBoasVindas() {
    setSalvandoBv(true);
    try {
      await api('/painel/marca', {
        method: 'PATCH',
        body: JSON.stringify({ boasVindasAtivo: bvAtivo, mensagemBoasVindas: bvMsg }),
      });
      toast.success('Boas-vindas salvas.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvandoBv(false);
    }
  }

  return (
    <Shell area="painel">
      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Marca</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Logo e cor exibidos na área dos seus alunos e nos certificados.</p>
        </div>

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
        <div className="ui-card p-5">
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
        <div className="ui-card p-5">
          <p className="font-semibold mb-3">Cor primária</p>
          <div className="flex items-center gap-3">
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="w-12 h-10 rounded border border-slate-300 dark:border-slate-600" />
            <input
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="w-32 ui-input"
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

        {/* Modal de boas-vindas */}
        <div className="ui-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Mensagem de boas-vindas</p>
              <p className="text-xs text-slate-400">Exibida em um modal quando o aluno entra na área de membros.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bvAtivo} onChange={(e) => setBvAtivo(e.target.checked)} />
              {bvAtivo ? 'Ativada' : 'Desativada'}
            </label>
          </div>
          <RichTextField value={bvMsg} onChange={setBvMsg} placeholder="Mensagem de boas-vindas (opcional)" />
          <button
            onClick={salvarBoasVindas}
            disabled={salvandoBv}
            className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {salvandoBv ? 'Salvando...' : 'Salvar boas-vindas'}
          </button>
        </div>
      </div>
    </Shell>
  );
}
