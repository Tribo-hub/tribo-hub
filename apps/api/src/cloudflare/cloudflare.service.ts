import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { env } from '@tribohub/config';

// Integração com a API de Custom Hostnames da Cloudflare (Cloudflare for SaaS).
// Permite ao produtor cadastrar um domínio próprio (ex.: area.cliente.com) que a
// Cloudflare valida e provisiona SSL automaticamente, sem trabalho manual da equipe.
// Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/

const API = 'https://api.cloudflare.com/client/v4';

export interface StatusDominio {
  hostname: string;
  id: string | null;
  // status geral da validação de propriedade do hostname
  status: 'pending' | 'active' | 'blocked' | 'moved' | 'deleted' | 'unknown';
  // status do certificado SSL
  sslStatus: string | null;
  // registros que o cliente precisa criar no DNS (validação/SSL), quando houver
  registros: Array<{ tipo: string; nome: string; valor: string }>;
  ativo: boolean; // pronto para uso (hostname active + ssl active)
}

@Injectable()
export class CloudflareService {
  private readonly log = new Logger(CloudflareService.name);

  // O recurso só funciona se as credenciais/zona estiverem configuradas.
  configurado(): boolean {
    return !!(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID);
  }

  // Alvo do CNAME que o cliente aponta no DNS dele.
  alvoCname(): string | null {
    return env.CLOUDFLARE_SAAS_TARGET ?? null;
  }

  private exigirConfig(): void {
    if (!this.configurado()) {
      throw new ServiceUnavailableException('Domínio próprio ainda não está disponível nesta instalação.');
    }
  }

  private async req(path: string, init?: RequestInit): Promise<any> {
    this.exigirConfig();
    const res = await fetch(`${API}/zones/${env.CLOUDFLARE_ZONE_ID}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      const msg = body?.errors?.[0]?.message || `Cloudflare respondeu ${res.status}`;
      this.log.warn(`Cloudflare API erro (${path}): ${msg}`);
      throw new ServiceUnavailableException(`Falha ao falar com a Cloudflare: ${msg}`);
    }
    return body?.result;
  }

  // Cria (ou recupera) o custom hostname para o domínio do cliente.
  async criar(hostname: string): Promise<StatusDominio> {
    const existente = await this.buscarPorHostname(hostname);
    if (existente.id) return existente; // idempotente

    const result = await this.req('/custom_hostnames', {
      method: 'POST',
      body: JSON.stringify({
        hostname,
        ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
      }),
    });
    return this.mapear(hostname, result);
  }

  // Consulta o status atual (validação de hostname + SSL) na Cloudflare.
  async buscarPorHostname(hostname: string): Promise<StatusDominio> {
    const lista = await this.req(`/custom_hostnames?hostname=${encodeURIComponent(hostname)}`);
    const result = Array.isArray(lista) ? lista[0] : null;
    if (!result) {
      return { hostname, id: null, status: 'unknown', sslStatus: null, registros: [], ativo: false };
    }
    return this.mapear(hostname, result);
  }

  // Remove o custom hostname (ao trocar/limpar o domínio).
  async remover(hostname: string): Promise<void> {
    const atual = await this.buscarPorHostname(hostname);
    if (atual.id) await this.req(`/custom_hostnames/${atual.id}`, { method: 'DELETE' });
  }

  private mapear(hostname: string, result: any): StatusDominio {
    const status = String(result?.status ?? 'unknown') as StatusDominio['status'];
    const sslStatus = result?.ssl?.status ?? null;
    // registros de validação (ownership) e de SSL, quando a Cloudflare os exige
    const registros: StatusDominio['registros'] = [];
    const ov = result?.ownership_verification;
    if (ov?.type && ov?.name && ov?.value) registros.push({ tipo: ov.type, nome: ov.name, valor: ov.value });
    for (const r of result?.ssl?.validation_records ?? []) {
      if (r?.txt_name && r?.txt_value) registros.push({ tipo: 'TXT', nome: r.txt_name, valor: r.txt_value });
    }
    return {
      hostname,
      id: result?.id ?? null,
      status,
      sslStatus,
      registros,
      ativo: status === 'active' && sslStatus === 'active',
    };
  }
}
