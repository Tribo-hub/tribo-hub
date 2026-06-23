import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlataformaExterna, StatusMatricula, StatusTransacao, TipoConta } from '@tribohub/db';
import { randomUUID } from 'crypto';
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

  // ---------- Validação comum (conta + segredo da integração) ----------
  private async validar(contaId: string, plataforma: PlataformaExterna, secret: string | undefined) {
    const conta = await this.prisma.conta.findUnique({ where: { id: contaId } });
    if (!conta || !conta.ativo || conta.tipoConta !== TipoConta.infoprodutor) {
      throw new NotFoundException('Conta inválida');
    }
    const integ = await this.prisma.integracao.findUnique({
      where: { contaId_plataforma: { contaId, plataforma } },
    });
    if (!integ || !integ.ativo || !integ.webhookSecret || integ.webhookSecret !== secret) {
      throw new UnauthorizedException('Webhook não autorizado');
    }
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
        await this.info.upsertMatricula(contaId, aluno.id, oferta.trilhaId, 'compra', expira, trans.id);

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
}
