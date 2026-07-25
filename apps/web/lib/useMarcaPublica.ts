'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import { salvarMarca } from './marca';
import { hostCustom, salvarSlugCustom, tenantDoHost } from './tenant';

export interface MarcaPublica {
  slug: string;
  nome: string;
  corPrimaria: string | null;
  logoUrl: string | null;
  tipoConta: 'corporativo' | 'infoprodutor';
  permiteAutoCadastro: boolean;
}

// Busca a marca do tenant (por subdomínio) para as telas públicas de login/cadastro,
// exibindo nome/logo/cor do cliente ANTES do login. Retorna null em app.tribohub.com.br/dev.
export function useMarcaPublica(): { marca: MarcaPublica | null; carregando: boolean } {
  const [marca, setMarca] = useState<MarcaPublica | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const custom = hostCustom(); // domínio próprio (Fase 2)
    const sub = tenantDoHost(); // subdomínio da plataforma (Fase 1)
    if (!custom && !sub) return; // domínio base / dev: sem marca por host

    // No domínio próprio o slug ainda não é conhecido — resolve por ?host=.
    // No subdomínio, o header X-Tenant-Slug (injetado pelo client) já identifica.
    const url = custom ? `/publico/marca?host=${encodeURIComponent(custom)}` : '/publico/marca';

    let vivo = true;
    setCarregando(true);
    api<MarcaPublica>(url)
      .then((m) => {
        if (!vivo) return;
        setMarca(m);
        salvarMarca(m); // aquece o cache usado no app após o login
        if (custom) salvarSlugCustom(custom, m.slug); // próximos requests já mandam X-Tenant-Slug
      })
      .catch(() => {
        /* endereço sem conta ativa: mantém marca padrão */
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  return { marca, carregando };
}
