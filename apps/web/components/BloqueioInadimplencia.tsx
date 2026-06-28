'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CopyButton } from './CopyButton';

interface FaturaAberta {
  competencia: string;
  valorTotal: string;
  status: string;
  vencimentoEm: string | null;
  pixCopiaECola: string | null;
}

// Tela exibida quando a conta está bloqueada por inadimplência.
// produtor: mostra a fatura em aberto + Pix para regularizar. aluno: aviso simples.
export function BloqueioInadimplencia({ tipo }: { tipo: 'produtor' | 'aluno' }) {
  const [f, setF] = useState<FaturaAberta | null>(null);

  useEffect(() => {
    if (tipo === 'produtor') api<FaturaAberta | null>('/painel/minha-fatura-aberta').then(setF).catch(() => {});
  }, [tipo]);

  return (
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="ui-card max-w-md w-full p-8 text-center">
        <div className="text-4xl mb-2">🔒</div>
        {tipo === 'aluno' ? (
          <>
            <h1 className="text-xl font-bold">Acesso temporariamente indisponível</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Esta área está suspensa no momento. Por favor, entre em contato com o responsável pela plataforma para regularizar o acesso.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Pagamento pendente</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Seu painel está bloqueado por uma fatura em aberto. Pague o Pix abaixo para reativar — a liberação é automática após a confirmação.
            </p>
            {f ? (
              <div className="mt-5 text-left">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Fatura {f.competencia}</span>
                  <span className="font-bold">R$ {Number(f.valorTotal).toFixed(2)}</span>
                </div>
                {f.vencimentoEm && (
                  <p className="text-xs text-slate-400 mt-0.5">Vencimento: {new Date(f.vencimentoEm).toLocaleDateString('pt-BR')}</p>
                )}
                {f.pixCopiaECola ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-1">Pix copia-e-cola:</p>
                    <code className="block bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-[11px] break-all">{f.pixCopiaECola}</code>
                    <div className="mt-2"><CopyButton texto={f.pixCopiaECola} label="Copiar Pix" /></div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-3">A cobrança está sendo gerada. Se o Pix não aparecer, fale com o suporte.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-4">Nenhuma fatura em aberto encontrada. Se isso parecer um engano, fale com o suporte.</p>
            )}
          </>
        )}
        <p className="text-xs text-slate-400 mt-6">Você pode usar “Alterar senha” e “Sair” normalmente no menu.</p>
      </div>
    </div>
  );
}
