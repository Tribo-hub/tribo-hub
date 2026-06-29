import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProprietarioConteudo, Role } from '@tribohub/db';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAulaDto,
  CreateModuloDto,
  CreateTrilhaDto,
  UpdateTrilhaDto,
} from './dto/conteudo.dto';

@Injectable()
export class ConteudoService {
  constructor(private readonly prisma: PrismaService) {}

  // Define a propriedade do conteúdo a partir do papel do usuário:
  // super_admin -> catálogo da plataforma | admin_tenant -> conteúdo isolado da conta
  private escopo(user: AuthUser) {
    if (user.role === Role.super_admin) {
      return { proprietarioTipo: ProprietarioConteudo.plataforma, contaId: null };
    }
    return { proprietarioTipo: ProprietarioConteudo.tenant, contaId: user.contaId };
  }

  private async trilhaDoUsuario(user: AuthUser, trilhaId: string) {
    const trilha = await this.prisma.trilha.findFirst({
      where: { id: trilhaId, deletedAt: null },
    });
    if (!trilha) throw new NotFoundException('Trilha não encontrada');
    const escopo = this.escopo(user);
    const dono =
      trilha.proprietarioTipo === escopo.proprietarioTipo &&
      trilha.contaId === escopo.contaId;
    if (!dono) throw new ForbiddenException('Conteúdo de outro proprietário');
    return trilha;
  }

  // ---------- Trilhas ----------
  criarTrilha(user: AuthUser, dto: CreateTrilhaDto) {
    return this.prisma.trilha.create({ data: { ...dto, ...this.escopo(user) } });
  }

  listarTrilhas(user: AuthUser) {
    return this.prisma.trilha.findMany({
      where: { deletedAt: null, ...this.escopo(user) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obterTrilha(user: AuthUser, id: string) {
    await this.trilhaDoUsuario(user, id);
    return this.prisma.trilha.findUnique({
      where: { id },
      include: {
        modulos: {
          where: { deletedAt: null },
          orderBy: { ordem: 'asc' },
          include: {
            aulas: { where: { deletedAt: null }, orderBy: { ordem: 'asc' } },
          },
        },
      },
    });
  }

  async atualizarTrilha(user: AuthUser, id: string, dto: UpdateTrilhaDto) {
    await this.trilhaDoUsuario(user, id);
    const { ofertaParaTrilhas, dripInicioEm, ...rest } = dto;
    return this.prisma.trilha.update({
      where: { id },
      data: {
        ...rest,
        ...(ofertaParaTrilhas !== undefined ? { ofertaParaTrilhas } : {}),
        ...(dripInicioEm !== undefined ? { dripInicioEm: dripInicioEm ? new Date(dripInicioEm) : null } : {}),
      },
    });
  }

  async removerTrilha(user: AuthUser, id: string) {
    await this.trilhaDoUsuario(user, id);
    await this.prisma.trilha.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // ---------- Módulos ----------
  async criarModulo(user: AuthUser, trilhaId: string, dto: CreateModuloDto) {
    await this.trilhaDoUsuario(user, trilhaId);
    return this.prisma.modulo.create({ data: { ...dto, trilhaId } });
  }

  private async moduloDoUsuario(user: AuthUser, moduloId: string) {
    const modulo = await this.prisma.modulo.findFirst({
      where: { id: moduloId, deletedAt: null },
    });
    if (!modulo) throw new NotFoundException('Módulo não encontrado');
    await this.trilhaDoUsuario(user, modulo.trilhaId);
    return modulo;
  }

  async atualizarModulo(user: AuthUser, id: string, dto: Partial<CreateModuloDto>) {
    await this.moduloDoUsuario(user, id);
    return this.prisma.modulo.update({ where: { id }, data: dto });
  }

  async removerModulo(user: AuthUser, id: string) {
    await this.moduloDoUsuario(user, id);
    await this.prisma.modulo.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // ---------- Aulas ----------
  async criarAula(user: AuthUser, moduloId: string, dto: CreateAulaDto) {
    await this.moduloDoUsuario(user, moduloId);
    const { anexos, ...rest } = dto;
    return this.prisma.aula.create({
      data: { ...rest, moduloId, anexos: (anexos ?? undefined) as object | undefined },
    });
  }

  private async aulaDoUsuario(user: AuthUser, aulaId: string) {
    const aula = await this.prisma.aula.findFirst({
      where: { id: aulaId, deletedAt: null },
    });
    if (!aula) throw new NotFoundException('Aula não encontrada');
    await this.moduloDoUsuario(user, aula.moduloId);
    return aula;
  }

  async atualizarAula(user: AuthUser, id: string, dto: Partial<CreateAulaDto>) {
    await this.aulaDoUsuario(user, id);
    const { anexos, ...rest } = dto;
    return this.prisma.aula.update({
      where: { id },
      data: { ...rest, ...(anexos !== undefined ? { anexos: anexos as object } : {}) },
    });
  }

  async removerAula(user: AuthUser, id: string) {
    await this.aulaDoUsuario(user, id);
    await this.prisma.aula.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // ---------- Quiz (perguntas da aula) ----------
  async listarPerguntas(user: AuthUser, aulaId: string) {
    await this.aulaDoUsuario(user, aulaId);
    return this.prisma.quizPergunta.findMany({
      where: { aulaId },
      orderBy: { ordem: 'asc' },
      include: { _count: { select: { respostas: true } } },
    });
  }

  async criarPergunta(user: AuthUser, aulaId: string, pergunta: string) {
    await this.aulaDoUsuario(user, aulaId);
    const max = await this.prisma.quizPergunta.aggregate({ where: { aulaId }, _max: { ordem: true } });
    return this.prisma.quizPergunta.create({
      data: { aulaId, pergunta, ordem: (max._max.ordem ?? 0) + 1 },
    });
  }

  async removerPergunta(user: AuthUser, perguntaId: string) {
    const p = await this.prisma.quizPergunta.findUnique({ where: { id: perguntaId } });
    if (!p) throw new NotFoundException('Pergunta não encontrada');
    await this.aulaDoUsuario(user, p.aulaId);
    await this.prisma.quizPergunta.delete({ where: { id: perguntaId } });
    return { ok: true };
  }

  async listarRespostas(user: AuthUser, perguntaId: string) {
    const p = await this.prisma.quizPergunta.findUnique({ where: { id: perguntaId } });
    if (!p) throw new NotFoundException('Pergunta não encontrada');
    await this.aulaDoUsuario(user, p.aulaId);
    const respostas = await this.prisma.quizResposta.findMany({
      where: { perguntaId },
      orderBy: { createdAt: 'desc' },
    });
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: respostas.map((r) => r.usuarioId) } },
      select: { id: true, nome: true },
    });
    const nome = new Map(usuarios.map((u) => [u.id, u.nome]));
    return respostas.map((r) => ({
      id: r.id,
      aluno: nome.get(r.usuarioId) ?? '—',
      resposta: r.resposta,
      data: r.createdAt,
    }));
  }

  // ---------- Comentários (moderação/resposta do produtor) ----------
  async listarComentariosAula(user: AuthUser, aulaId: string) {
    await this.aulaDoUsuario(user, aulaId);
    const comentarios = await this.prisma.comentarioAula.findMany({
      where: { aulaId, contaId: user.contaId!, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const autores = await this.prisma.usuario.findMany({
      where: { id: { in: [...new Set(comentarios.map((c) => c.usuarioId))] } },
      select: { id: true, nome: true, role: true },
    });
    const amap = new Map(autores.map((a) => [a.id, a]));
    const fmt = (c: (typeof comentarios)[number]) => ({
      id: c.id,
      texto: c.texto,
      autor: amap.get(c.usuarioId)?.nome ?? 'Usuário',
      isProdutor: (amap.get(c.usuarioId)?.role ?? 'aluno') !== 'aluno',
      data: c.createdAt,
    });
    return comentarios
      .filter((c) => !c.respostaAId)
      .map((c) => ({ ...fmt(c), respostas: comentarios.filter((r) => r.respostaAId === c.id).map(fmt) }));
  }

  async responderComentario(user: AuthUser, aulaId: string, texto: string, respostaAId?: string) {
    await this.aulaDoUsuario(user, aulaId);
    if (!user.contaId) throw new ForbiddenException('Conta inválida para comentar');
    if (!texto?.trim()) throw new BadRequestException('Comentário vazio');
    const c = await this.prisma.comentarioAula.create({
      data: {
        aulaId,
        usuarioId: user.sub,
        contaId: user.contaId,
        texto: texto.trim(),
        respostaAId: respostaAId ?? null,
      },
    });
    return { ok: true, id: c.id };
  }

  async removerComentarioModeracao(user: AuthUser, comentarioId: string) {
    const c = await this.prisma.comentarioAula.findFirst({
      where: { id: comentarioId, contaId: user.contaId!, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Comentário não encontrado');
    await this.aulaDoUsuario(user, c.aulaId); // garante que a aula pertence ao produtor
    await this.prisma.comentarioAula.update({ where: { id: comentarioId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
