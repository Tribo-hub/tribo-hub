import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrigemMatricula,
  StatusMatricula,
  TipoAcesso,
} from '@tribohub/db';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CortesiaDto, CreateOfertaDto, IntegracaoDto } from './dto';

@Injectable()
export class InfoprodutorService {
  constructor(private readonly prisma: PrismaService) {}

  private calcExpira(tipoAcesso: TipoAcesso, dias?: number | null): Date | null {
    if (tipoAcesso === TipoAcesso.vitalicio) return null;
    const d = dias ?? 365;
    return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
  }

  // ---------- Ofertas ----------
  async criarOferta(contaId: string, dto: CreateOfertaDto) {
    const trilha = await this.prisma.trilha.findFirst({
      where: { id: dto.trilhaId, contaId, deletedAt: null },
    });
    if (!trilha) throw new NotFoundException('Trilha não encontrada nesta conta');
    return this.prisma.oferta.create({
      data: {
        contaId,
        trilhaId: dto.trilhaId,
        nome: dto.nome,
        plataformaExterna: dto.plataformaExterna ?? 'hotmart',
        codigoProdutoExterno: dto.codigoProdutoExterno,
        tipoAcesso: dto.tipoAcesso,
        duracaoAcessoDias: dto.tipoAcesso === TipoAcesso.vitalicio ? null : dto.duracaoAcessoDias ?? 365,
      },
    });
  }

  listarOfertas(contaId: string) {
    return this.prisma.oferta.findMany({
      where: { contaId },
      include: { trilha: { select: { titulo: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- Integrações ----------
  async definirIntegracao(contaId: string, dto: IntegracaoDto) {
    return this.prisma.integracao.upsert({
      where: { contaId_plataforma: { contaId, plataforma: dto.plataforma } },
      create: { contaId, plataforma: dto.plataforma, webhookSecret: dto.webhookSecret },
      update: { webhookSecret: dto.webhookSecret, ativo: true },
      select: { id: true, plataforma: true, ativo: true },
    });
  }

  listarIntegracoes(contaId: string) {
    return this.prisma.integracao.findMany({
      where: { contaId },
      select: { id: true, plataforma: true, ativo: true, createdAt: true },
    });
  }

  // ---------- Matrículas ----------
  listarMatriculas(contaId: string) {
    return this.prisma.matricula.findMany({
      where: { contaId },
      include: {
        usuario: { select: { nome: true, email: true } },
        trilha: { select: { titulo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Conta de alunos ATIVOS (matrícula ativa e não vencida) — base da cobrança. Dedupe por usuário.
  async contarAlunosAtivos(contaId: string) {
    const ativas = await this.prisma.matricula.findMany({
      where: {
        contaId,
        status: StatusMatricula.ativa,
        OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }],
      },
      select: { usuarioId: true },
    });
    return new Set(ativas.map((m) => m.usuarioId)).size;
  }

  // Dashboard: taxa de conclusão por curso (trilha) da conta.
  async dashboardCursos(contaId: string) {
    const trilhas = await this.prisma.trilha.findMany({
      where: { contaId, deletedAt: null },
      select: { id: true, titulo: true },
    });
    return Promise.all(
      trilhas.map(async (t) => {
        const [matriculas, certificados] = await Promise.all([
          this.prisma.matricula.count({ where: { contaId, trilhaId: t.id } }),
          this.prisma.certificado.count({ where: { contaId, trilhaId: t.id } }),
        ]);
        return {
          trilhaId: t.id,
          titulo: t.titulo,
          matriculas,
          certificados,
          taxaConclusao: matriculas ? Math.round((certificados / matriculas) * 100) : 0,
        };
      }),
    );
  }

  // Dashboard: vendas do mês (receita) + últimas transações aprovadas.
  async dashboardVendas(contaId: string) {
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    inicioMes.setUTCHours(0, 0, 0, 0);

    const [agg, ultimas] = await Promise.all([
      this.prisma.transacao.aggregate({
        where: { contaId, status: 'aprovada', eventoEm: { gte: inicioMes } },
        _sum: { valorBruto: true },
        _count: true,
      }),
      this.prisma.transacao.findMany({
        where: { contaId, status: 'aprovada' },
        orderBy: { eventoEm: 'desc' },
        take: 8,
        include: { usuario: { select: { nome: true } } },
      }),
    ]);

    return {
      receitaMes: Number(agg._sum.valorBruto ?? 0),
      vendasMes: agg._count,
      ultimas: ultimas.map((t) => ({
        id: t.id,
        aluno: t.usuario?.nome ?? '—',
        valor: Number(t.valorBruto),
        data: t.eventoEm,
      })),
    };
  }

  private async matriculaDaConta(contaId: string, id: string) {
    const m = await this.prisma.matricula.findFirst({ where: { id, contaId } });
    if (!m) throw new NotFoundException('Matrícula não encontrada');
    return m;
  }

  async inativarMatricula(contaId: string, id: string) {
    await this.matriculaDaConta(contaId, id);
    return this.prisma.matricula.update({ where: { id }, data: { status: StatusMatricula.inativa } });
  }

  async reativarMatricula(contaId: string, id: string) {
    await this.matriculaDaConta(contaId, id);
    return this.prisma.matricula.update({ where: { id }, data: { status: StatusMatricula.ativa } });
  }

  async prorrogarMatricula(contaId: string, id: string, dias: number) {
    const m = await this.matriculaDaConta(contaId, id);
    const base = m.expiraEm && m.expiraEm > new Date() ? m.expiraEm : new Date();
    const expiraEm = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
    return this.prisma.matricula.update({
      where: { id },
      data: { expiraEm, status: StatusMatricula.ativa },
    });
  }

  async criarCortesia(contaId: string, dto: CortesiaDto) {
    const trilha = await this.prisma.trilha.findFirst({
      where: { id: dto.trilhaId, contaId, deletedAt: null },
    });
    if (!trilha) throw new NotFoundException('Trilha não encontrada nesta conta');
    const usuario = await this.encontrarOuCriarAluno(contaId, dto.email, dto.nome);
    const expiraEm = dto.duracaoAcessoDias
      ? new Date(Date.now() + dto.duracaoAcessoDias * 24 * 60 * 60 * 1000)
      : null;
    return this.upsertMatricula(contaId, usuario.id, dto.trilhaId, OrigemMatricula.cortesia, expiraEm, null);
  }

  // Job de expiração (chamado por cron protegido)
  async expirarMatriculas() {
    const res = await this.prisma.matricula.updateMany({
      where: { status: StatusMatricula.ativa, expiraEm: { not: null, lt: new Date() } },
      data: { status: StatusMatricula.expirada },
    });
    return { expiradas: res.count };
  }

  // ---------- Helpers compartilhados (usados também pelo webhook) ----------
  async encontrarOuCriarAluno(contaId: string, email: string, nome: string) {
    const emailNorm = email.trim().toLowerCase();
    const existente = await this.prisma.usuario.findFirst({ where: { email: emailNorm, contaId } });
    if (existente) return existente;
    const senhaHash = await bcrypt.hash(randomBytes(12).toString('base64url'), 12);
    return this.prisma.usuario.create({
      data: { contaId, nome: nome || emailNorm, email: emailNorm, senhaHash, role: 'aluno' },
    });
  }

  async upsertMatricula(
    contaId: string,
    usuarioId: string,
    trilhaId: string,
    origem: OrigemMatricula,
    expiraEm: Date | null,
    transacaoId: string | null,
  ) {
    return this.prisma.matricula.upsert({
      where: { usuarioId_trilhaId: { usuarioId, trilhaId } },
      create: { contaId, usuarioId, trilhaId, origem, status: StatusMatricula.ativa, expiraEm, transacaoId },
      update: { status: StatusMatricula.ativa, expiraEm, transacaoId },
    });
  }
}
