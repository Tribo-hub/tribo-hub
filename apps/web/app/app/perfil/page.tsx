'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clearToken, getToken, uploadAvatar } from '../../../lib/api';
import { toast } from '../../../lib/toast';

interface Me {
  nome: string;
  email: string;
  telefone: string | null;
  avatarUrl: string | null;
  conta?: { corPrimaria: string | null };
}

export default function PerfilPage() {
  const router = useRouter();
  const [cor, setCor] = useState('#7c3aed');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const m = await api<Me>('/me');
      setNome(m.nome ?? '');
      setEmail(m.email ?? '');
      setTelefone(m.telefone ?? '');
      setPreview(m.avatarUrl ?? null);
      setCor(m.conta?.corPrimaria || '#7c3aed');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); }
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    carregar();
  }, [router, carregar]);

  async function enviarFoto(file: File) {
    setEnviandoFoto(true);
    try {
      const path = await uploadAvatar(file);
      setAvatarPath(path);
      setPreview(URL.createObjectURL(file));
      toast.success('Foto enviada. Clique em “Salvar” para confirmar.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar a foto');
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const payload: Record<string, string> = { nome, email, telefone };
      if (avatarPath) payload.avatarUrl = avatarPath;
      await api('/me', { method: 'PATCH', body: JSON.stringify(payload) });
      toast.success('Perfil atualizado.');
      setAvatarPath(null);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setSalvando(false);
    }
  }

  const iniciais = (nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <main>
      <div className="max-w-lg mx-auto px-5 py-8">
        <h1 className="text-xl font-bold mb-1">Meu perfil</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Atualize a sua foto e os seus dados.</p>

        <form onSubmit={salvar} className="ui-card p-6 space-y-5">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 grid place-items-center shrink-0">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-semibold text-slate-500">{iniciais}</span>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && enviarFoto(e.target.files[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={enviandoFoto}
                className="text-sm font-semibold px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                {enviandoFoto ? 'Enviando...' : preview ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              <p className="text-xs text-slate-400 mt-1">JPG ou PNG.</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required className="w-full ui-input mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full ui-input mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Telefone</label>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="w-full ui-input mt-1" />
          </div>

          <button type="submit" disabled={salvando} style={{ backgroundColor: cor }}
            className="w-full text-white font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </main>
  );
}
