'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import { salvarMarca } from './marca';
import { tenantDoHost } from './tenant';

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
    if (!tenantDoHost()) return; // domínio base / dev: sem marca por host
    let vivo = true;
    setCarregando(true);
    api<MarcaPublica>('/publico/marca')
      .then((m) => {
        if (!vivo) return;
        setMarca(m);
        salvarMarca(m); // aquece o cache usado no app após o login
      })
      .catch(() => {
        /* subdomínio sem conta ativa: mantém marca padrão */
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  return { marca, carregando };
}
