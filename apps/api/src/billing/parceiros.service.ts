import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusComissao } from '@tribohub/db';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParceirosService {
  constructor(private readonly prisma: PrismaService) {}

  private async codigoUnico(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const codigo = 'PRT' + randomBytes(3).toString('hex').toUpperCase(); // PRT + 6 hex
      if (!(await this.prisma.parceiro.findUnique({ where: { codigo } }))) return codigo;
    }
    return 'PRT' + randomBytes(5).toString('hex').toUpperCase();
  }

  // Lista parceiros com totais de comissão (pendente/disponível/paga) e nº de contas indicadas.
  async listar() {
    const parceiros = await this.prisma.parceiro.findMany({ orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }] });
    const [porStatus, porConta] = await Promise.all([
      this.prisma.comissaoParceiro.groupBy({ by: ['parceiroId', 'status'], _sum: { valor: true } }),
      this.prisma.conta.groupBy({ by: ['referidoPorParceiroId'], _count: { _all: true } }),
    ]);
    const soma = (pid: string, st: StatusComissao) =>
      Number(porStatus.find((g) => g.parceiroId === pid && g.status === st)?._sum.valor ?? 0);
    return parceiros.map((p) => ({
      ...p,
      contasReferidas: porConta.find((g) => g.referidoPorParceiroId === p.id)?._count._all ?? 0,
      comissaoPendente: soma(p.id, StatusComissao.pendente),
      comissaoDisponivel: soma(p.id, StatusComissao.disponivel),
      comissaoPaga: soma(p.id, StatusComissao.paga),
    }));
  }

  async criar(dto: { nome: string; email?: string; documento?: string; chavePix?: string; comissaoPercentual?: number; tiers?: unknown; observacao?: string }) {
    if (!dto.nome?.trim()) throw new BadRequestException('Nome obrigatório');
    const codigo = await this.codigoUnico();
    return this.prisma.parceiro.create({
      data: {
        codigo,
        nome: dto.nome.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        documento: dto.documento?.trim() || null,
        chavePix: dto.chavePix?.trim() || null,
        comissaoPercentual: dto.comissaoPercentual ?? 20,
        tiers: (dto.tiers as never) ?? undefined,
        observacao: dto.observacao?.trim() || null,
      },
    });
  }

  async atualizar(id: string, dto: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const k of ['nome', 'email', 'documento', 'chavePix', 'comissaoPercentual', 'tiers', 'observacao', 'ativo'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (typeof data.email === 'string') data.email = (data.email as string).trim().toLowerCase() || null;
    return this.prisma.parceiro.update({ where: { id }, data });
  }

  async remover(id: string) {
    return this.prisma.parceiro.update({ where: { id }, data: { ativo: false } });
  }

  // Detalhe: dados do parceiro + contas indicadas + comissões + totais.
  async obter(id: string) {
    const parceiro = await this.prisma.parceiro.findUnique({ where: { id } });
    if (!parceiro) throw new NotFoundException('Parceiro não encontrado');
    const [contas, comissoes] = await Promise.all([
      this.prisma.conta.findMany({
        where: { referidoPorParceiroId: id },
        select: { id: true, nome: true, tipoConta: true, ativo: true, referidoEm: true },
        orderBy: { referidoEm: 'desc' },
      }),
      this.prisma.comissaoParceiro.findMany({ where: { parceiroId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    const soma = (st: StatusComissao) =>
      comissoes.filter((c) => c.status === st).reduce((s, c) => s + Number(c.valor), 0);
    return {
      parceiro,
      contas,
      comissoes,
      totais: {
        pendente: soma(StatusComissao.pendente),
        disponivel: soma(StatusComissao.disponivel),
        paga: soma(StatusComissao.paga),
      },
    };
  }

  // Atribui (ou remove) o parceiro indicador de uma conta, com histórico.
  async atribuirParceiro(contaId: string, parceiroId: string | null, motivo?: string) {
    const conta = await this.prisma.conta.findUnique({ where: { id: contaId }, select: { referidoPorParceiroId: true } });
    if (!conta) throw new NotFoundException('Conta não encontrada');
    if (parceiroId) {
      const p = await this.prisma.parceiro.findUnique({ where: { id: parceiroId } });
      if (!p) throw new BadRequestException('Parceiro inválido');
    }
    if (conta.referidoPorParceiroId === parceiroId) return { ok: true, semMudanca: true };
    await this.prisma.$transaction([
      this.prisma.trocaParceiroConta.create({
        data: { contaId, parceiroAnteriorId: conta.referidoPorParceiroId, parceiroNovoId: parceiroId, motivo: motivo ?? null },
      }),
      this.prisma.conta.update({
        where: { id: contaId },
        data: { referidoPorParceiroId: parceiroId, referidoEm: parceiroId ? new Date() : null },
      }),
    ]);
    return { ok: true };
  }

  parceiroDaConta(contaId: string) {
    return this.prisma.conta.findUnique({ where: { id: contaId }, select: { referidoPorParceiroId: true, referidoEm: true } });
  }

  listarComissoes(filtros: { status?: StatusComissao; parceiroId?: string; competencia?: string }) {
    return this.prisma.comissaoParceiro.findMany({
      where: {
        ...(filtros.status ? { status: filtros.status } : {}),
        ...(filtros.parceiroId ? { parceiroId: filtros.parceiroId } : {}),
        ...(filtros.competencia ? { competencia: filtros.competencia } : {}),
      },
      include: { parceiro: { select: { nome: true, codigo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  // Marca uma comissão disponível como paga.
  async pagarComissao(id: string) {
    const c = await this.prisma.comissaoParceiro.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Comissão não encontrada');
    if (c.status !== StatusComissao.disponivel) throw new BadRequestException('Só é possível pagar comissões disponíveis');
    return this.prisma.comissaoParceiro.update({ where: { id }, data: { status: StatusComissao.paga, pagaEm: new Date() } });
  }

  // Paga em lote todas as comissões disponíveis de um parceiro.
  async pagarComissoesParceiro(parceiroId: string) {
    const r = await this.prisma.comissaoParceiro.updateMany({
      where: { parceiroId, status: StatusComissao.disponivel },
      data: { status: StatusComissao.paga, pagaEm: new Date() },
    });
    return { pagas: r.count };
  }
}
