import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { env } from '@tribohub/config';
import * as fs from 'fs';
import * as https from 'https';

@Injectable()
export class EfiService {
  private readonly log = new Logger('EfiService');
  private agent?: https.Agent;
  private token?: { value: string; exp: number };
  private cobToken?: { value: string; exp: number };

  private get host() {
    return env.EFI_SANDBOX === 'false' ? 'pix.api.efipay.com.br' : 'pix-h.api.efipay.com.br';
  }

  // API de Cobranças (boleto/cartão) — host e credenciais SEPARADOS do Pix; não usa certificado.
  private get cobHost() {
    return env.EFI_SANDBOX === 'false' ? 'cobrancas.api.efipay.com.br' : 'cobrancas-h.api.efipay.com.br';
  }
  cobrancasConfigurado() {
    return !!(env.EFI_COBRANCAS_CLIENT_ID && env.EFI_COBRANCAS_CLIENT_SECRET);
  }

  // Cert pode vir como arquivo (.p12 local, dev) ou base64 (produção/Railway).
  private lerCertificado(): Buffer | null {
    if (env.EFI_CERTIFICATE_BASE64) {
      return Buffer.from(env.EFI_CERTIFICATE_BASE64, 'base64');
    }
    if (env.EFI_CERTIFICATE_PATH && fs.existsSync(env.EFI_CERTIFICATE_PATH)) {
      return fs.readFileSync(env.EFI_CERTIFICATE_PATH);
    }
    return null;
  }

  private configurado() {
    return !!(env.EFI_CLIENT_ID && env.EFI_CLIENT_SECRET && this.lerCertificado());
  }

  private getAgent() {
    if (!this.agent) {
      const pfx = this.lerCertificado();
      if (!pfx) throw new InternalServerErrorException('Certificado Efí ausente');
      this.agent = new https.Agent({ pfx, passphrase: '' });
    }
    return this.agent;
  }

  private req<T = any>(
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<{ status: number; body: T }> {
    const data = body ? JSON.stringify(body) : null;
    return new Promise((resolve, reject) => {
      const r = https.request(
        {
          hostname: this.host,
          path,
          method,
          agent: this.getAgent(),
          headers: {
            ...headers,
            ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
          },
        },
        (res) => {
          let b = '';
          res.on('data', (d) => (b += d));
          res.on('end', () => {
            let parsed: any;
            try {
              parsed = JSON.parse(b);
            } catch {
              parsed = b;
            }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        },
      );
      r.on('error', reject);
      if (data) r.write(data);
      r.end();
    });
  }

  private async auth(): Promise<string> {
    if (this.token && this.token.exp > Date.now()) return this.token.value;
    const basic = Buffer.from(`${env.EFI_CLIENT_ID}:${env.EFI_CLIENT_SECRET}`).toString('base64');
    const r = await this.req<{ access_token: string; expires_in: number }>(
      '/oauth/token',
      'POST',
      { Authorization: `Basic ${basic}` },
      { grant_type: 'client_credentials' },
    );
    if (r.status >= 300 || !r.body.access_token) {
      this.log.error(`Auth Efí falhou: ${r.status}`);
      throw new InternalServerErrorException('Falha na autenticação com a Efí');
    }
    this.token = { value: r.body.access_token, exp: Date.now() + (r.body.expires_in - 60) * 1000 };
    return this.token.value;
  }

  // Cria uma cobrança Pix imediata e retorna o copia-e-cola + QR Code.
  async criarCobrancaPix(params: { valor: number; descricao: string }) {
    if (!this.configurado()) {
      throw new InternalServerErrorException('Efí não configurada (credenciais/certificado ausentes)');
    }
    const token = await this.auth();
    const cob = await this.req<any>(
      '/v2/cob',
      'POST',
      { Authorization: `Bearer ${token}` },
      {
        calendario: { expiracao: 3600 },
        valor: { original: params.valor.toFixed(2) },
        chave: env.EFI_PIX_KEY,
        solicitacaoPagador: params.descricao.slice(0, 140),
      },
    );
    if (cob.status >= 300) {
      this.log.error(`Criar cobrança Efí falhou: ${cob.status} ${JSON.stringify(cob.body).slice(0, 200)}`);
      throw new InternalServerErrorException('Falha ao criar cobrança Pix na Efí');
    }

    let copiaECola: string | undefined = cob.body.pixCopiaECola;
    let imagemQrcode: string | undefined;
    const locId = cob.body.loc?.id;
    if (locId) {
      const qr = await this.req<any>(`/v2/loc/${locId}/qrcode`, 'GET', { Authorization: `Bearer ${token}` });
      if (qr.status < 300) {
        copiaECola = qr.body.qrcode ?? copiaECola;
        imagemQrcode = qr.body.imagemQrcode;
      }
    }
    return {
      txid: cob.body.txid,
      status: cob.body.status,
      valor: params.valor,
      pixCopiaECola: copiaECola,
      imagemQrcode,
    };
  }

  // ===== API de Cobranças (boleto/cartão) — Fase 3c =====
  // Request sem mTLS (Cobranças não usa certificado), contra o host de Cobranças.
  private reqCob<T = any>(
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<{ status: number; body: T }> {
    const data = body ? JSON.stringify(body) : null;
    return new Promise((resolve, reject) => {
      const r = https.request(
        {
          hostname: this.cobHost,
          path,
          method,
          headers: {
            ...headers,
            ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
          },
        },
        (res) => {
          let b = '';
          res.on('data', (d) => (b += d));
          res.on('end', () => {
            let parsed: any;
            try { parsed = JSON.parse(b); } catch { parsed = b; }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        },
      );
      r.on('error', reject);
      if (data) r.write(data);
      r.end();
    });
  }

  private async authCob(): Promise<string> {
    if (this.cobToken && this.cobToken.exp > Date.now()) return this.cobToken.value;
    const basic = Buffer.from(`${env.EFI_COBRANCAS_CLIENT_ID}:${env.EFI_COBRANCAS_CLIENT_SECRET}`).toString('base64');
    const r = await this.reqCob<{ access_token: string; expires_in: number }>(
      '/v1/authorize',
      'POST',
      { Authorization: `Basic ${basic}` },
      { grant_type: 'client_credentials' },
    );
    if (r.status >= 300 || !r.body.access_token) {
      this.log.error(`Auth Cobranças Efí falhou: ${r.status}`);
      throw new InternalServerErrorException('Falha na autenticação com a Efí (Cobranças)');
    }
    this.cobToken = { value: r.body.access_token, exp: Date.now() + (r.body.expires_in - 60) * 1000 };
    return this.cobToken.value;
  }

  // Emite um boleto (charge one-step). expireAt no formato YYYY-MM-DD. notification_url por cobrança.
  async criarBoleto(params: {
    valor: number;
    descricao: string;
    customId: string;
    expireAt: string;
    customer: { nome: string; email: string; cpf?: string; cnpj?: string; razaoSocial?: string; telefone?: string };
  }) {
    if (!this.cobrancasConfigurado()) {
      throw new InternalServerErrorException('Efí Cobranças não configurada (EFI_COBRANCAS_CLIENT_ID/SECRET ausentes)');
    }
    const token = await this.authCob();
    const c = params.customer;
    const somenteDigitos = (s?: string) => (s ?? '').replace(/\D/g, '');
    const customer = c.cnpj
      ? { juridical_person: { corporate_name: c.razaoSocial || c.nome, cnpj: somenteDigitos(c.cnpj) }, email: c.email, ...(c.telefone ? { phone_number: somenteDigitos(c.telefone) } : {}) }
      : { name: c.nome, cpf: somenteDigitos(c.cpf), email: c.email, ...(c.telefone ? { phone_number: somenteDigitos(c.telefone) } : {}) };

    const body = {
      items: [{ name: params.descricao.slice(0, 255), value: Math.round(params.valor * 100), amount: 1 }],
      payment: {
        banking_billet: {
          expire_at: params.expireAt,
          customer,
          message: 'Tribo Hub — assinatura da plataforma',
        },
      },
      metadata: { notification_url: env.EFI_NOTIFICATION_URL, custom_id: params.customId.slice(0, 255) },
    };

    const r = await this.reqCob<any>('/v1/charge/one-step', 'POST', { Authorization: `Bearer ${token}` }, body);
    if (r.status >= 300 || !r.body?.data) {
      this.log.error(`Criar boleto Efí falhou: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      throw new InternalServerErrorException('Falha ao gerar o boleto na Efí');
    }
    const d = r.body.data;
    return {
      chargeId: String(d.charge_id ?? ''),
      status: d.status as string,
      link: (d.link ?? d.pdf?.charge) as string | undefined,
      pdf: d.pdf?.charge as string | undefined,
      linhaDigitavel: d.barcode as string | undefined,
      expireAt: d.expire_at as string | undefined,
    };
  }

  // Cria uma assinatura de cartão (recorrência) a partir de um plano. payment_token vem do SDK no front.
  async criarAssinaturaCartao(params: {
    planId: string;
    paymentToken: string;
    valor: number;
    customId: string;
    descricao: string;
    customer: { nome: string; cpf: string; email: string; nascimento: string; telefone?: string };
    endereco?: { rua: string; numero: string; bairro: string; cep: string; cidade: string; estado: string; complemento?: string };
  }) {
    if (!this.cobrancasConfigurado()) {
      throw new InternalServerErrorException('Efí Cobranças não configurada');
    }
    const token = await this.authCob();
    const dig = (s?: string) => (s ?? '').replace(/\D/g, '');
    const credit_card: Record<string, unknown> = {
      payment_token: params.paymentToken,
      customer: {
        name: params.customer.nome,
        cpf: dig(params.customer.cpf),
        email: params.customer.email,
        birth: params.customer.nascimento,
        ...(params.customer.telefone ? { phone_number: dig(params.customer.telefone) } : {}),
      },
    };
    if (params.endereco) {
      credit_card.billing_address = {
        street: params.endereco.rua,
        number: params.endereco.numero,
        neighborhood: params.endereco.bairro,
        zipcode: dig(params.endereco.cep),
        city: params.endereco.cidade,
        state: params.endereco.estado,
        ...(params.endereco.complemento ? { complement: params.endereco.complemento } : {}),
      };
    }
    const body = {
      items: [{ name: params.descricao.slice(0, 255), value: Math.round(params.valor * 100), amount: 1 }],
      payment: { credit_card },
      metadata: { notification_url: env.EFI_NOTIFICATION_URL, custom_id: params.customId.slice(0, 255) },
    };
    const r = await this.reqCob<any>(`/v1/plan/${params.planId}/subscription/one-step`, 'POST', { Authorization: `Bearer ${token}` }, body);
    if (r.status >= 300 || !r.body?.data) {
      this.log.error(`Criar assinatura cartão Efí falhou: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      throw new InternalServerErrorException('Falha ao criar a assinatura de cartão na Efí');
    }
    const d = r.body.data;
    return {
      subscriptionId: String(d.subscription_id ?? d.id ?? ''),
      status: (d.status ?? d.subscription?.status) as string,
      cardMask: (d.payment?.credit_card?.mask ?? d.card_mask ?? d.mask) as string | undefined,
    };
  }

  // Consulta uma notificação da API de Cobranças (token recebido no webhook) → lista de eventos.
  async consultarNotificacao(token: string): Promise<Array<{ custom_id?: string; status?: { current?: string }; identifiers?: { charge_id?: number; subscription_id?: number } }>> {
    if (!this.cobrancasConfigurado()) return [];
    const auth = await this.authCob();
    const r = await this.reqCob<any>(`/v1/notification/${token}`, 'GET', { Authorization: `Bearer ${auth}` });
    if (r.status >= 300 || !Array.isArray(r.body?.data)) {
      this.log.error(`Consultar notificação Cobranças falhou: ${r.status}`);
      return [];
    }
    return r.body.data;
  }
}
