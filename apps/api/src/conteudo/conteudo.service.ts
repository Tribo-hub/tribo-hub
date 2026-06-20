import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.trilha.update({ where: { id }, data: dto });
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
    return this.prisma.aula.create({ data: { ...dto, moduloId } });
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
    return this.prisma.aula.update({ where: { id }, data: dto });
  }

  async removerAula(user: AuthUser, id: string) {
    await this.aulaDoUsuario(user, id);
    await this.prisma.aula.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
