import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoConta } from '@tribohub/db';
import { PrismaService } from '../prisma/prisma.service';
import { EfiService } from './efi.service';

export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly efi: EfiService,
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
    return this.prisma.faturaPlataforma.update({
      where: { id: faturaId },
      data: { status: 'paga', pagoEm: new Date() },
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
}
