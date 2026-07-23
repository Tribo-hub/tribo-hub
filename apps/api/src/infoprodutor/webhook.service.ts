import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlataformaExterna, StatusMatricula, StatusTransacao, TipoConta } from '@tribohub/db';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { InfoprodutorService } from './infoprodutor.service';

const EVENTOS_LIBERA = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'APPROVED', 'COMPLETE'];
const EVENTOS_REVOGA = [
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_CANCELED',
  'SUBSCRIPTION_CANCELLATION',
  'REFUNDED',
  'CHARGEBACK',
];

// Evento normalizado — cada plataforma parseia o seu payload para este formato comum.
type EventoNorm = {
  tipo: 'libera' | 'revoga' | 'ignora';
  email?: string;
  nome: string;
  produtoId: string;
  transacao: string;
  valor: number;
};

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly info: InfoprodutorService,
    private readonly email: EmailService,
  ) {}

  // ---------- Entradas públicas por plataforma ----------

  async hotmart(contaId: string, secret: string | undefined, body: any) {
    await this.validar(contaId, PlataformaExterna.hotmart, secret);
    return this.aplicar(PlataformaExterna.hotmart, contaId, body, this.parseHotmart(body));
  }

  async kiwify(contaId: string, secret: string | undefined, body: any) {
    await this.validar(contaId, PlataformaExterna.kiwify, secret);
    return this.aplicar(PlataformaExterna.kiwify, contaId, body, this.parseKiwify(body));
  }

  async eduzz(contaId: string, secret: string | undefined, body: any) {
    await this.validar(contaId, PlataformaExterna.eduzz, secret);
    return this.aplicar(PlataformaExterna.eduzz, contaId, body, this.parseEduzz(body));
  }

  // Checkout Efí via middleware do produtor — validado por HMAC (não por segredo em texto).
  async efi(contaId: string, assinatura: string | undefined, body: any) {
    await this.validarEfi(contaId, body, assinatura);
    return this.aplicar(PlataformaExterna.efi, contaId, body, this.parseEfi(body));
  }

  // ---------- Validação comum (conta + integração ativa) ----------
  private async buscarIntegracao(contaId: string, plataforma: PlataformaExterna) {
    const conta = await this.prisma.conta.findUnique({ where: { id: contaId } });
    if (!conta || !conta.ativo || conta.tipoConta !== TipoConta.infoprodutor) {
      throw new NotFoundException('Conta inválida');
    }
    const integ = await this.prisma.integracao.findUnique({
      where: { contaId_plataforma: { contaId, plataforma } },
    });
    if (!integ || !integ.ativo || !integ.webhookSecret) {
      throw new UnauthorizedException('Webhook não autorizado');
    }
    return integ;
  }

  // Hotmart/Kiwify/Eduzz: segredo estático comparado por igualdade.
  private async validar(contaId: string, plataforma: PlataformaExterna, secret: string | undefined) {
    const integ = await this.buscarIntegracao(contaId, plataforma);
    if (integ.webhookSecret !== secret) {
      throw new UnauthorizedException('Webhook não autorizado');
    }
  }

  // Efí: assinatura HMAC-SHA256 dos campos canônicos, comparada em tempo constante.
  private async validarEfi(contaId: string, body: any, assinatura: string | undefined) {
    const integ = await this.buscarIntegracao(contaId, PlataformaExterna.efi);
    const esperada = this.assinaturaEfi(integ.webhookSecret as string, body);
    const enviada = Buffer.from(assinatura ?? '', 'utf8');
    const referencia = Buffer.from(esperada, 'utf8');
    if (enviada.length !== referencia.length || !timingSafeEqual(enviada, referencia)) {
      throw new UnauthorizedException('Assinatura inválida');
    }
  }

  // Base assinada = "evento.email.produtoId.transacao.valor" (valores crus, na ordem, unidos por ".").
  private assinaturaEfi(secret: string, body: any): string {
    const base = [body?.evento, body?.email, body?.produtoId, body?.transacao, body?.valor]
      .map((v) => String(v ?? ''))
      .join('.');
    return createHmac('sha256', secret).update(base).digest('hex');
  }

  // ---------- Núcleo: libera/revoga acesso a partir do evento normalizado ----------
  private async aplicar(
    plataforma: PlataformaExterna,
    contaId: string,
    bodyRaw: any,
    ev: EventoNorm,
  ) {
    const hash = `${plataforma}:${contaId}:${ev.transacao}:${ev.tipo}`;
    const jaProcessado = await this.prisma.webhookEvent.findUnique({ where: { hash } });
    if (jaProcessado) return { duplicate: true };

    const event = await this.prisma.webhookEvent.create({
      data: { contaId, plataforma, eventoTipo: ev.tipo, hash, payload: bodyRaw, processado: false },
    });

    let resultado = 'ignorado';
    try {
      const oferta = ev.produtoId
        ? await this.prisma.oferta.findFirst({
            where: { contaId, plataformaExterna: plataforma, codigoProdutoExterno: ev.produtoId },
          })
        : null;

      if (oferta && ev.email && ev.tipo === 'libera') {
        const existente = await this.prisma.usuario.findFirst({
          where: { email: ev.email.toLowerCase(), contaId },
        });
        const aluno = await this.info.encontrarOuCriarAluno(contaId, ev.email, ev.nome);
        const trans = await this.prisma.transacao.upsert({
          where: { codigoTransacaoExterno: ev.transacao },
          create: {
            contaId,
            ofertaId: oferta.id,
            usuarioId: aluno.id,
            plataformaExterna: plataforma,
            codigoTransacaoExterno: ev.transacao,
            valorBruto: ev.valor,
            status: StatusTransacao.aprovada,
            eventoEm: new Date(),
          },
          update: { status: StatusTransacao.aprovada },
        });
        const expira =
          oferta.tipoAcesso === 'vitalicio'
            ? null
            : new Date(Date.now() + (oferta.duracaoAcessoDias ?? 365) * 86400000);
        const turmaId = await this.info.resolverTurma(oferta.trilhaId, oferta.turmaId);
        await this.info.upsertMatricula(contaId, aluno.id, oferta.trilhaId, 'compra', expira, trans.id, turmaId);

        let tokenAtivacao: string | null = null;
        if (!existente) {
          tokenAtivacao = randomUUID();
          await this.prisma.inviteToken.create({
            data: {
              email: ev.email.toLowerCase(),
              contaId,
              role: 'aluno',
              token: tokenAtivacao,
              expiraEm: new Date(Date.now() + 30 * 86400000),
            },
          });
        }
        await this.email.acessoLiberado(ev.email, ev.nome, oferta.nome, tokenAtivacao).catch(() => {});
        await this.prisma.notificacao
          .create({
            data: {
              usuarioId: aluno.id,
              contaId,
              titulo: 'Acesso liberado 🎉',
              mensagem: `Sua matrícula em "${oferta.nome}" está ativa. Bons estudos!`,
              tipo: 'matricula',
            },
          })
          .catch(() => undefined);
        resultado = 'acesso_liberado';
      } else if (oferta && ev.email && ev.tipo === 'revoga') {
        const aluno = await this.prisma.usuario.findFirst({
          where: { email: ev.email.toLowerCase(), contaId },
        });
        if (aluno) {
          await this.prisma.matricula.updateMany({
            where: { contaId, usuarioId: aluno.id, trilhaId: oferta.trilhaId },
            data: { status: StatusMatricula.inativa },
          });
          await this.prisma.transacao.updateMany({
            where: { codigoTransacaoExterno: ev.transacao },
            data: { status: StatusTransacao.reembolsada },
          });
          resultado = 'acesso_revogado';
        }
      }
      await this.prisma.webhookEvent.update({ where: { id: event.id }, data: { processado: true } });
    } catch (e) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { erro: e instanceof Error ? e.message : 'erro' },
      });
      throw e;
    }

    return { ok: true, tipo: ev.tipo, resultado };
  }

  // ---------- Parsers por plataforma ----------

  private parseHotmart(body: any): EventoNorm {
    const evento: string = body?.event ?? body?.data?.purchase?.status ?? 'UNKNOWN';
    const email: string | undefined = body?.data?.buyer?.email;
    const produtoId = String(body?.data?.product?.id ?? body?.data?.product?.ucode ?? '');
    return {
      tipo: EVENTOS_LIBERA.includes(evento) ? 'libera' : EVENTOS_REVOGA.includes(evento) ? 'revoga' : 'ignora',
      email,
      nome: body?.data?.buyer?.name ?? email ?? 'Aluno',
      produtoId,
      transacao: String(body?.data?.purchase?.transaction ?? body?.data?.transaction ?? `${produtoId}-${email}`),
      valor: Number(body?.data?.purchase?.price?.value ?? 0),
    };
  }

  // VALIDAR com payload real da Kiwify (order webhook). Campos conforme docs públicas.
  private parseKiwify(body: any): EventoNorm {
    const status = String(body?.order_status ?? body?.status ?? '').toLowerCase();
    const email: string | undefined =
      body?.Customer?.email ?? body?.customer?.email ?? body?.buyer?.email;
    const produtoId = String(body?.Product?.product_id ?? body?.product_id ?? body?.Product?.id ?? '');
    const cents = Number(body?.Commissions?.charge_amount ?? body?.charge_amount ?? 0);
    return {
      tipo: ['paid', 'approved'].includes(status)
        ? 'libera'
        : ['refunded', 'chargedback', 'chargeback'].includes(status)
          ? 'revoga'
          : 'ignora',
      email,
      nome: body?.Customer?.full_name ?? body?.customer?.full_name ?? email ?? 'Aluno',
      produtoId,
      transacao: String(body?.order_id ?? body?.id ?? `${produtoId}-${email}`),
      valor: cents > 0 ? cents / 100 : Number(body?.order?.amount ?? 0),
    };
  }

  // VALIDAR com payload real da Eduzz. Status histórico: 3=paga, 7/11=reembolso/chargeback.
  private parseEduzz(body: any): EventoNorm {
    const status = String(body?.trans_status ?? body?.status ?? '').toLowerCase();
    const PAID = ['3', 'paid', 'invoice_paid', 'aprovada', 'paga'];
    const REFUND = ['7', '11', 'refunded', 'invoice_refunded', 'reembolsada', 'chargeback', 'blocked'];
    const email: string | undefined = body?.cli_email ?? body?.customer?.email ?? body?.buyer_email;
    const produtoId = String(body?.product_cod ?? body?.content_code ?? body?.product_id ?? '');
    return {
      tipo: PAID.includes(status) ? 'libera' : REFUND.includes(status) ? 'revoga' : 'ignora',
      email,
      nome: body?.cli_nome ?? body?.customer?.name ?? email ?? 'Aluno',
      produtoId,
      transacao: String(body?.trans_cod ?? body?.id ?? `${produtoId}-${email}`),
      valor: Number(body?.trans_value ?? body?.value ?? 0),
    };
  }

  // Efí — payload já normalizado pelo middleware do produtor.
  // evento é case-insensitive; valor chega em CENTAVOS e é gravado em reais (÷100), como na Kiwify.
  private parseEfi(body: any): EventoNorm {
    const evento = String(body?.evento ?? '').toUpperCase();
    const centavos = Number(body?.valor ?? 0);
    const email: string | undefined = body?.email;
    return {
      tipo: EVENTOS_LIBERA.includes(evento) ? 'libera' : EVENTOS_REVOGA.includes(evento) ? 'revoga' : 'ignora',
      email,
      nome: body?.nome ?? email ?? 'Aluno',
      produtoId: String(body?.produtoId ?? ''),
      transacao: String(body?.transacao ?? ''),
      valor: centavos > 0 ? centavos / 100 : 0,
    };
  }
}
