import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { env } from '@tribohub/config';
import * as fs from 'fs';
import * as https from 'https';

@Injectable()
export class EfiService {
  private readonly log = new Logger('EfiService');
  private agent?: https.Agent;
  private token?: { value: string; exp: number };

  private get host() {
    return env.EFI_SANDBOX === 'false' ? 'pix.api.efipay.com.br' : 'pix-h.api.efipay.com.br';
  }

  private configurado() {
    return !!(
      env.EFI_CLIENT_ID &&
      env.EFI_CLIENT_SECRET &&
      env.EFI_CERTIFICATE_PATH &&
      fs.existsSync(env.EFI_CERTIFICATE_PATH)
    );
  }

  private getAgent() {
    if (!this.agent) {
      const pfx = fs.readFileSync(env.EFI_CERTIFICATE_PATH!);
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
}
