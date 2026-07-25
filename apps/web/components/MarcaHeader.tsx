'use client';

import type { MarcaPublica } from '../lib/useMarcaPublica';

// Cabeçalho de marca das telas públicas (login/cadastro/esqueci-senha).
// Sem marca de tenant (app.tribohub.com.br / dev): exibe a marca padrão Tribo Hub.
export function MarcaHeader({ marca }: { marca: MarcaPublica | null }) {
  const nome = marca?.nome ?? 'Tribo Hub';
  const cor = marca?.corPrimaria ?? undefined;

  return (
    <div className="flex items-center gap-2">
      {marca?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={marca.logoUrl} alt={nome} className="w-9 h-9 rounded-lg object-cover" />
      ) : (
        <div
          className="w-9 h-9 rounded-lg grid place-items-center text-white font-bold bg-tribo-600"
          style={cor ? { backgroundColor: cor } : undefined}
        >
          {nome.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="font-bold text-lg text-slate-900 dark:text-white">{nome}</span>
    </div>
  );
}
