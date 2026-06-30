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
        turmaId: dto.turmaId ?? null,
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
      include: { trilha: { select: { titulo: true } }, turma: { select: { nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async atualizarOferta(contaId: string, id: string, dto: Partial<CreateOfertaDto>) {
    const oferta = await this.prisma.oferta.findFirst({ where: { id, contaId } });
    if (!oferta) throw new NotFoundException('Oferta não encontrada');
    if (dto.trilhaId) {
      const trilha = await this.prisma.trilha.findFirst({ where: { id: dto.trilhaId, contaId, deletedAt: null } });
      if (!trilha) throw new NotFoundException('Trilha não encontrada nesta conta');
    }
    return this.prisma.oferta.update({
      where: { id },
      data: {
        trilhaId: dto.trilhaId,
        ...(dto.turmaId !== undefined ? { turmaId: dto.turmaId || null } : {}),
        nome: dto.nome,
        plataformaExterna: dto.plataformaExterna,
        codigoProdutoExterno: dto.codigoProdutoExterno,
        tipoAcesso: dto.tipoAcesso,
        duracaoAcessoDias:
          dto.tipoAcesso === TipoAcesso.vitalicio ? null : dto.duracaoAcessoDias,
      },
    });
  }

  async removerOferta(contaId: string, id: string) {
    const oferta = await this.prisma.oferta.findFirst({ where: { id, contaId } });
    if (!oferta) throw new NotFoundException('Oferta não encontrada');
    await this.prisma.oferta.delete({ where: { id } });
    return { ok: true };
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
        usuario: { select: { id: true, nome: true, email: true, telefone: true } },
        trilha: { select: { titulo: true } },
        turma: { select: { nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Edição do aluno pelo produtor (nome/e-mail/telefone/senha). Só usuários da própria conta.
  async atualizarAluno(
    contaId: string,
    usuarioId: string,
    dto: { nome?: string; email?: string; telefone?: string; senha?: string },
  ) {
    const aluno = await this.prisma.usuario.findFirst({ where: { id: usuarioId, contaId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado nesta conta');

    const data: { nome?: string; email?: string; telefone?: string; senhaHash?: string } = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.telefone !== undefined) data.telefone = dto.telefone;
    if (dto.email !== undefined) {
      const emailNorm = dto.email.trim().toLowerCase();
      const colisao = await this.prisma.usuario.findFirst({
        where: { email: emailNorm, contaId, id: { not: usuarioId } },
      });
      if (colisao) throw new ForbiddenException('Já existe um usuário com este e-mail nesta conta');
      data.email = emailNorm;
    }
    if (dto.senha) data.senhaHash = await bcrypt.hash(dto.senha, 12);

    const atualizado = await this.prisma.usuario.update({ where: { id: usuarioId }, data });
    return { id: atualizado.id, nome: atualizado.nome, email: atualizado.email, telefone: atualizado.telefone };
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
        const [matriculas, certificados, agg] = await Promise.all([
          this.prisma.matricula.count({ where: { contaId, trilhaId: t.id } }),
          this.prisma.certificado.count({ where: { contaId, trilhaId: t.id } }),
          this.prisma.progresso.aggregate({
            where: { contaId, avaliacao: { not: null }, aula: { modulo: { trilhaId: t.id } } },
            _avg: { avaliacao: true },
            _count: { avaliacao: true },
          }),
        ]);
        return {
          trilhaId: t.id,
          titulo: t.titulo,
          matriculas,
          certificados,
          taxaConclusao: matriculas ? Math.round((certificados / matriculas) * 100) : 0,
          avaliacaoMedia: agg._avg.avaliacao ? Math.round(agg._avg.avaliacao * 10) / 10 : null,
          avaliacoes: agg._count.avaliacao,
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
    // turma escolhida na cortesia ou, se a trilha usa turmas, resolve a turma aberta
    const turmaId = dto.turmaId ?? (await this.resolverTurma(dto.trilhaId, null));
    return this.upsertMatricula(contaId, usuario.id, dto.trilhaId, OrigemMatricula.cortesia, expiraEm, null, turmaId);
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
    turmaId: string | null = null,
  ) {
    return this.prisma.matricula.upsert({
      where: { usuarioId_trilhaId: { usuarioId, trilhaId } },
      create: { contaId, usuarioId, trilhaId, origem, status: StatusMatricula.ativa, expiraEm, transacaoId, turmaId },
      // na re-matrícula mantém a turma atual se já houver; só define quando vier uma turma nova
      update: { status: StatusMatricula.ativa, expiraEm, transacaoId, ...(turmaId ? { turmaId } : {}) },
    });
  }

  // Resolve a turma de uma matrícula na trilha: oferta vinculada > janela de matrículas aberta > próxima a abrir.
  async resolverTurma(trilhaId: string, ofertaTurmaId: string | null): Promise<string | null> {
    const trilha = await this.prisma.trilha.findUnique({ where: { id: trilhaId }, select: { usaTurmas: true } });
    if (!trilha?.usaTurmas) return null;
    if (ofertaTurmaId) return ofertaTurmaId;

    const turmas = await this.prisma.turma.findMany({ where: { trilhaId, ativa: true } });
    if (turmas.length === 0) return null;
    const now = Date.now();
    const aberta = (t: (typeof turmas)[number]) =>
      (!t.matriculasAbremEm || t.matriculasAbremEm.getTime() <= now) &&
      (!t.matriculasFechamEm || t.matriculasFechamEm.getTime() >= now);
    const ini = (t: (typeof turmas)[number]) => t.inicioEm?.getTime() ?? Infinity;

    const abertas = turmas.filter(aberta).sort((a, b) => ini(a) - ini(b));
    if (abertas.length) return abertas[0].id;

    // nenhuma aberta → próxima a abrir (menor data de abertura/início no futuro)
    const chave = (t: (typeof turmas)[number]) => (t.matriculasAbremEm?.getTime() ?? t.inicioEm?.getTime() ?? Infinity);
    const futuras = turmas
      .filter((t) => (t.matriculasAbremEm && t.matriculasAbremEm.getTime() > now) || (t.inicioEm && t.inicioEm.getTime() > now))
      .sort((a, b) => chave(a) - chave(b));
    return futuras[0]?.id ?? null;
  }
}
