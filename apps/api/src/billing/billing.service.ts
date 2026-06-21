import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoConta } from '@tribohub/db';
import { PrismaService } from '../prisma/prisma.service';

export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

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
