import { Injectable, NotFoundException } from '@nestjs/common';
import { StatusAssinatura, StatusFatura, TipoConta } from '@tribohub/db';
import { env } from '@tribohub/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EfiService } from './efi.service';

export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DIA_MS = 86_400_000;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly efi: EfiService,
    private readonly email: EmailService,
  ) {}

  // Emite uma cobrança Pix (Efí) para a fatura informada.
  async cobrar(faturaId: string) {
    const fatura = await this.prisma.faturaPlataforma.findUnique({
      where: { id: faturaId },
      include: { conta: { select: { nome: true } } },
    });
    if (!fatura) throw new NotFoundException('Fatura não encontrada');
    const cob = await this.efi.criarCobrancaPix({
      valor: Number(fatura.valorTotal),
      descricao: `Tribo Hub - fatura ${fatura.competencia} - ${fatura.conta.nome}`,
    });
    await this.prisma.faturaPlataforma.update({
      where: { id: faturaId },
      data: { txid: cob.txid, pixCopiaECola: cob.pixCopiaECola },
    });
    return cob;
  }

  // Confirma pagamento de uma fatura a partir do txid (usado pelo webhook da Efí).
  async confirmarPagamentoPorTxid(txid: string) {
    if (!txid) return { ok: false, motivo: 'txid ausente' };
    const fatura = await this.prisma.faturaPlataforma.findFirst({ where: { txid } });
    if (!fatura) return { ok: false, motivo: 'fatura não encontrada' };
    if (fatura.status === 'paga') return { ok: true, jaPaga: true };
    await this.prisma.faturaPlataforma.update({
      where: { id: fatura.id },
      data: { status: 'paga', pagoEm: new Date() },
    });
    await this.reativarPorPagamento(fatura.contaId);
    return { ok: true, faturaId: fatura.id };
  }

  // Processa a notificação Pix da Efí: { pix: [{ txid, ... }] }.
  async processarWebhookEfi(body: { pix?: Array<{ txid?: string }> }) {
    const itens = Array.isArray(body?.pix) ? body.pix : [];
    const resultados = [];
    for (const p of itens) {
      if (p?.txid) resultados.push(await this.confirmarPagamentoPorTxid(p.txid));
    }
    return { ok: true, processados: resultados.length };
  }

  // Marca uma fatura como paga (registro manual pelo super admin).
  async marcarPaga(faturaId: string) {
    const fatura = await this.prisma.faturaPlataforma.findUnique({ where: { id: faturaId } });
    if (!fatura) throw new NotFoundException('Fatura não encontrada');
    const atualizada = await this.prisma.faturaPlataforma.update({
      where: { id: faturaId },
      data: { status: 'paga', pagoEm: new Date() },
    });
    await this.reativarPorPagamento(fatura.contaId);
    return atualizada;
  }

  // Pagamento confirmado: limpa os marcadores de inadimplência e libera a conta.
  async reativarPorPagamento(contaId: string) {
    await this.prisma.assinaturaPlataforma.updateMany({
      where: { contaId, status: { not: StatusAssinatura.cancelada } },
      data: {
        status: StatusAssinatura.ativa,
        inadimplenteDesde: null,
        ultimoEstadoBilling: null,
        ultimoEstadoBillingEm: null,
        painelBloqueado: false,
        alunosBloqueados: false,
      },
    });
  }

  // Calcula (sem salvar) a fatura de uma conta para a competência.
  async calcular(contaId: string) {
    const conta = await this.prisma.conta.findUnique({
      where: { id: contaId },
      include: { assinatura: true },
    });
    if (!conta || !conta.assinatura) throw new NotFoundException('Conta/assinatura não encontrada');
    const ass = conta.assinatura;
    const valorBase = Number(ass.valorBase);

    if (conta.tipoConta === TipoConta.infoprodutor) {
      const ativosRaw = await this.prisma.matricula.findMany({
        where: { contaId, status: 'ativa', OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }] },
        select: { usuarioId: true },
      });
      const alunosAtivos = new Set(ativosRaw.map((m) => m.usuarioId)).size;
      const incluidos = ass.alunosIncluidos ?? 0;
      const excedentes = Math.max(0, alunosAtivos - incluidos);
      const valorExcedente = excedentes * Number(ass.valorPorExcedente ?? 0);
      return {
        tipo: 'infoprodutor' as const,
        alunosAtivos,
        assentosUsados: null,
        valorBase,
        valorExcedente,
        valorTotal: valorBase + valorExcedente,
      };
    }

    const assentosUsados = await this.prisma.usuario.count({
      where: { contaId, role: 'aluno', ativo: true },
    });
    return {
      tipo: 'corporativo' as const,
      alunosAtivos: null,
      assentosUsados,
      valorBase,
      valorExcedente: 0,
      valorTotal: valorBase,
    };
  }

  // Calcula e grava a fatura (idempotente por conta+competência).
  async fecharFatura(contaId: string, competencia: string) {
    const existente = await this.prisma.faturaPlataforma.findUnique({
      where: { contaId_competencia: { contaId, competencia } },
    });
    if (existente?.status === 'paga') return existente; // não recalcula fatura já paga
    const c = await this.calcular(contaId);
    return this.prisma.faturaPlataforma.upsert({
      where: { contaId_competencia: { contaId, competencia } },
      create: {
        contaId,
        competencia,
        alunosAtivos: c.alunosAtivos,
        assentosUsados: c.assentosUsados,
        valorBase: c.valorBase,
        valorExcedente: c.valorExcedente,
        valorTotal: c.valorTotal,
        fechadaEm: new Date(),
      },
      update: {
        alunosAtivos: c.alunosAtivos,
        assentosUsados: c.assentosUsados,
        valorBase: c.valorBase,
        valorExcedente: c.valorExcedente,
        valorTotal: c.valorTotal,
        fechadaEm: new Date(),
      },
    });
  }

  // Fecha a fatura de todas as contas ativas com assinatura.
  async fecharTodas(competencia: string) {
    const contas = await this.prisma.conta.findMany({
      where: { ativo: true, assinatura: { isNot: null } },
      select: { id: true },
    });
    const faturas = [];
    for (const c of contas) {
      faturas.push(await this.fecharFatura(c.id, competencia));
    }
    return { competencia, quantidade: faturas.length };
  }

  async listar(competencia: string) {
    const faturas = await this.prisma.faturaPlataforma.findMany({
      where: { competencia },
      include: { conta: { select: { nome: true, tipoConta: true } } },
      orderBy: { valorTotal: 'desc' },
    });
    const mrr = faturas.reduce((s, f) => s + Number(f.valorTotal), 0);
    return { competencia, mrr, totalContas: faturas.length, faturas };
  }

  // Fatura em aberto (pendente/vencida) da conta — usada na tela de "regularize" do produtor.
  async faturaAbertaDaConta(contaId: string) {
    return this.prisma.faturaPlataforma.findFirst({
      where: { contaId, status: { in: [StatusFatura.pendente, StatusFatura.vencida] } },
      orderBy: { fechadaEm: 'desc' },
      select: { id: true, competencia: true, valorTotal: true, status: true, vencimentoEm: true, pixCopiaECola: true },
    });
  }

  // ===== Ciclo de vida da fatura (máquina de estados diária, idempotente) =====
  async processarCicloVida(hoje: Date = new Date()) {
    const VENC = env.BILLING_DIAS_VENCIMENTO;
    const PAINEL = env.BILLING_SUSPENSAO_PAINEL_DIAS;
    const ALUNOS = env.BILLING_SUSPENSAO_ALUNOS_DIAS;
    const reais = (v: unknown) => `R$ ${Number(v).toFixed(2)}`;

    const faturas = await this.prisma.faturaPlataforma.findMany({
      where: { status: { in: [StatusFatura.pendente, StatusFatura.vencida] } },
      include: { conta: { select: { id: true, assinatura: true } } },
      orderBy: { fechadaEm: 'asc' },
    });

    let processadas = 0;
    for (const f of faturas) {
      const ass = f.conta.assinatura;
      if (!ass || ass.status === StatusAssinatura.cancelada) continue;

      // 1) Fatura recém-fechada: emite a cobrança Pix, define o vencimento e avisa.
      if (!f.vencimentoEm) {
        const venc = new Date(f.fechadaEm.getTime() + VENC * DIA_MS);
        if (Number(f.valorTotal) > 0 && !f.txid) {
          try { await this.cobrar(f.id); } catch { /* Efí indisponível: tenta no próximo ciclo */ }
        }
        await this.prisma.faturaPlataforma.update({
          where: { id: f.id },
          data: { vencimentoEm: venc, metodoPagamento: f.metodoPagamento ?? 'pix' },
        });
        await this.avisar(f.conta.id, 'Sua fatura está disponível',
          `<p>A fatura de <b>${f.competencia}</b> no valor de <b>${reais(f.valorTotal)}</b> está disponível. Vence em ${venc.toLocaleDateString('pt-BR')}.</p>`);
        await this.marcarEstado(ass.id, 'emitida', hoje);
        processadas++;
        continue;
      }

      const diasParaVencer = Math.ceil((f.vencimentoEm.getTime() - hoje.getTime()) / DIA_MS);

      // 2) Avisos antes de vencer (D-3 / D-1)
      if (f.status === StatusFatura.pendente && diasParaVencer <= 3 && diasParaVencer >= 0) {
        const marcador = diasParaVencer <= 1 ? 'aviso_d1' : 'aviso_d3';
        if (ass.ultimoEstadoBilling !== marcador && ass.ultimoEstadoBilling !== 'aviso_d1') {
          await this.avisar(f.conta.id, 'Sua fatura vence em breve',
            `<p>A fatura de <b>${f.competencia}</b> (${reais(f.valorTotal)}) vence em ${f.vencimentoEm.toLocaleDateString('pt-BR')}.</p>`);
          await this.marcarEstado(ass.id, marcador, hoje);
          processadas++;
        }
        continue;
      }

      // 3) Vencida → inadimplente → (15d) painel → (30d) alunos
      if (diasParaVencer < 0) {
        if (f.status !== StatusFatura.vencida) {
          await this.prisma.faturaPlataforma.update({ where: { id: f.id }, data: { status: StatusFatura.vencida } });
        }
        const marcou = await this.prisma.assinaturaPlataforma.updateMany({
          where: { id: ass.id, inadimplenteDesde: null },
          data: { status: StatusAssinatura.inadimplente, inadimplenteDesde: hoje },
        });
        if (marcou.count > 0) {
          await this.avisar(f.conta.id, 'Pagamento em atraso',
            `<p>A fatura de <b>${f.competencia}</b> está em atraso. Regularize para manter o seu acesso.</p>`);
        }
        const ancora = ass.inadimplenteDesde ?? hoje;
        const atraso = Math.floor((hoje.getTime() - ancora.getTime()) / DIA_MS);

        if (atraso >= PAINEL && !ass.painelBloqueado) {
          const r = await this.prisma.assinaturaPlataforma.updateMany({
            where: { id: ass.id, painelBloqueado: false },
            data: { painelBloqueado: true, status: StatusAssinatura.suspensa },
          });
          if (r.count > 0) {
            await this.avisar(f.conta.id, 'Painel bloqueado por inadimplência',
              `<p>Após ${PAINEL} dias de atraso, o seu painel foi bloqueado. Regularize a fatura para reativar.</p>`);
          }
        }
        if (atraso >= ALUNOS && !ass.alunosBloqueados) {
          const r = await this.prisma.assinaturaPlataforma.updateMany({
            where: { id: ass.id, alunosBloqueados: false },
            data: { alunosBloqueados: true },
          });
          if (r.count > 0) {
            await this.avisar(f.conta.id, 'Acesso dos alunos suspenso',
              `<p>Após ${ALUNOS} dias de atraso, o acesso dos seus alunos foi suspenso. Regularize para reativar.</p>`);
          }
        }
        processadas++;
      }
    }
    return { processadas };
  }

  private async marcarEstado(assinaturaId: string, estado: string, hoje: Date) {
    await this.prisma.assinaturaPlataforma.update({
      where: { id: assinaturaId },
      data: { ultimoEstadoBilling: estado, ultimoEstadoBillingEm: hoje },
    });
  }

  // Envia aviso ao admin da conta (fire-and-forget: nunca quebra o ciclo).
  private async avisar(contaId: string, titulo: string, corpo: string) {
    try {
      const admin = await this.prisma.usuario.findFirst({
        where: { contaId, role: 'admin_tenant', ativo: true },
        select: { email: true },
      });
      if (admin?.email) await this.email.cobranca(admin.email, titulo, corpo);
    } catch {
      /* fire-and-forget */
    }
  }
}
