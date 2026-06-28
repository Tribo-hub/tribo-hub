'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

// Modal de troca de senha do próprio usuário (qualquer papel). Renderize controlado por `open`.
export function AlterarSenhaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!open) return null;

  function fechar() {
    setAtual(''); setNova(''); setConf('');
    onClose();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nova.length < 6) { toast.error('A nova senha deve ter ao menos 6 caracteres.'); return; }
    if (nova !== conf) { toast.error('A confirmação não confere com a nova senha.'); return; }
    setSalvando(true);
    try {
      await api('/me/senha', { method: 'PATCH', body: JSON.stringify({ senhaAtual: atual, novaSenha: nova }) });
      toast.success('Senha alterada com sucesso.');
      fechar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={fechar}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={salvar} className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Alterar senha</p>
          <button type="button" onClick={fechar} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Senha atual</label>
            <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} required autoComplete="current-password" className="w-full ui-input mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Nova senha</label>
            <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} required minLength={6} autoComplete="new-password" placeholder="mínimo 6 caracteres" className="w-full ui-input mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">Confirmar nova senha</label>
            <input type="password" value={conf} onChange={(e) => setConf(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full ui-input mt-1" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button type="button" onClick={fechar} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2">Cancelar</button>
          <button type="submit" disabled={salvando} className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            {salvando ? 'Salvando...' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
