import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { StatusMatricula, StatusTransacao, TipoConta } from '@tribohub/db';
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

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly info: InfoprodutorService,
    private readonly email: EmailService,
  ) {}

  async hotmart(contaId: string, hottok: string | undefined, body: any) {
    const conta = await this.prisma.conta.findUnique({ where: { id: contaId } });
    if (!conta || !conta.ativo || conta.tipoConta !== TipoConta.infoprodutor) {
      throw new NotFoundException('Conta inválida');
    }
    const integ = await this.prisma.integracao.findUnique({
      where: { contaId_plataforma: { contaId, plataforma: 'hotmart' } },
    });
    if (!integ || !integ.ativo || integ.webhookSecret !== hottok) {
      throw new UnauthorizedException('Webhook não autorizado');
    }

    const evento: string = body?.event ?? body?.data?.purchase?.status ?? 'UNKNOWN';
    const email: string | undefined = body?.data?.buyer?.email;
    const nome: string = body?.data?.buyer?.name ?? email ?? 'Aluno';
    const produtoId = String(body?.data?.product?.id ?? body?.data?.product?.ucode ?? '');
    const transacao = String(body?.data?.purchase?.transaction ?? body?.data?.transaction ?? `${produtoId}-${email}`);
    const valor = Number(body?.data?.purchase?.price?.value ?? 0);

    // idempotência
    const hash = `hotmart:${contaId}:${transacao}:${evento}`;
    const jaProcessado = await this.prisma.webhookEvent.findUnique({ where: { hash } });
    if (jaProcessado) return { duplicate: true };

    const event = await this.prisma.webhookEvent.create({
      data: { contaId, plataforma: 'hotmart', eventoTipo: evento, hash, payload: body, processado: false },
    });

    let resultado = 'ignorado';
    try {
      const oferta = produtoId
        ? await this.prisma.oferta.findFirst({
            where: { contaId, plataformaExterna: 'hotmart', codigoProdutoExterno: produtoId },
          })
        : null;

      if (oferta && email && EVENTOS_LIBERA.includes(evento)) {
        const existente = await this.prisma.usuario.findFirst({
          where: { email: email.toLowerCase(), contaId },
        });
        const aluno = await this.info.encontrarOuCriarAluno(contaId, email, nome);
        const trans = await this.prisma.transacao.upsert({
          where: { codigoTransacaoExterno: transacao },
          create: {
            contaId,
            ofertaId: oferta.id,
            usuarioId: aluno.id,
            plataformaExterna: 'hotmart',
            codigoTransacaoExterno: transacao,
            valorBruto: valor,
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

        // e-mail de acesso: comprador novo recebe link p/ definir senha
        let tokenAtivacao: string | null = null;
        if (!existente) {
          tokenAtivacao = randomUUID();
          await this.prisma.inviteToken.create({
            data: {
              email: email.toLowerCase(),
              contaId,
              role: 'aluno',
              token: tokenAtivacao,
              expiraEm: new Date(Date.now() + 30 * 86400000),
            },
          });
        }
        await this.email.acessoLiberado(email, nome, oferta.nome, tokenAtivacao).catch(() => {});
        resultado = 'acesso_liberado';
      } else if (oferta && email && EVENTOS_REVOGA.includes(evento)) {
        const aluno = await this.prisma.usuario.findFirst({
          where: { email: email.toLowerCase(), contaId },
        });
        if (aluno) {
          await this.prisma.matricula.updateMany({
            where: { contaId, usuarioId: aluno.id, trilhaId: oferta.trilhaId },
            data: { status: StatusMatricula.inativa },
          });
          await this.prisma.transacao.updateMany({
            where: { codigoTransacaoExterno: transacao },
            data: { status: EVENTOS_REVOGA.includes(evento) ? StatusTransacao.reembolsada : StatusTransacao.cancelada },
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

    return { ok: true, evento, resultado };
  }
}
