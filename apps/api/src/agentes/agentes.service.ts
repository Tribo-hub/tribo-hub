import { Injectable, NotFoundException } from '@nestjs/common';
import { ProprietarioConteudo } from '@tribohub/db';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgenteDto, CreateAgenteTenantDto } from './dto';

type AgentePublico = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  icone: string | null;
  url: string;
};

function normalizarUrl(url: string) {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

@Injectable()
export class AgentesService {
  constructor(private readonly prisma: PrismaService) {}

  private publico(a: {
    id: string;
    nome: string;
    descricao: string | null;
    categoria: string | null;
    icone: string | null;
    url: string;
  }): AgentePublico {
    return { id: a.id, nome: a.nome, descricao: a.descricao, categoria: a.categoria, icone: a.icone, url: a.url };
  }

  // ---------- Super Admin (catálogo de plataforma — corporativo global) ----------
  listarPlataforma() {
    return this.prisma.agenteIA.findMany({
      where: { proprietarioTipo: ProprietarioConteudo.plataforma },
      orderBy: { createdAt: 'desc' },
    });
  }

  criarPlataforma(dto: CreateAgenteDto) {
    return this.prisma.agenteIA.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        categoria: dto.categoria,
        icone: dto.icone,
        url: normalizarUrl(dto.url),
        proprietarioTipo: ProprietarioConteudo.plataforma,
        contaId: null,
      },
    });
  }

  async removerPlataforma(id: string) {
    await this.prisma.agenteIA.deleteMany({ where: { id, proprietarioTipo: ProprietarioConteudo.plataforma } });
    return { ok: true };
  }

  // ---------- Produtor (tenant — por trilha) ----------
  async listarTenant(contaId: string) {
    const ags = await this.prisma.agenteIA.findMany({
      where: { contaId, proprietarioTipo: ProprietarioConteudo.tenant },
      include: { trilhas: true },
      orderBy: { createdAt: 'desc' },
    });
    return ags.map((a) => ({
      id: a.id,
      nome: a.nome,
      descricao: a.descricao,
      categoria: a.categoria,
      icone: a.icone,
      url: a.url,
      ativo: a.ativo,
      todasTrilhas: a.todasTrilhas,
      trilhaIds: a.trilhas.map((t) => t.trilhaId),
    }));
  }

  criarTenant(contaId: string, dto: CreateAgenteTenantDto) {
    return this.prisma.agenteIA.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        categoria: dto.categoria,
        icone: dto.icone,
        url: normalizarUrl(dto.url),
        proprietarioTipo: ProprietarioConteudo.tenant,
        contaId,
        todasTrilhas: dto.todasTrilhas ?? false,
        trilhas: { create: (dto.trilhaIds ?? []).map((trilhaId) => ({ trilhaId })) },
      },
    });
  }

  async atualizarTenant(contaId: string, id: string, dto: CreateAgenteTenantDto) {
    const ag = await this.prisma.agenteIA.findFirst({ where: { id, contaId } });
    if (!ag) throw new NotFoundException('Agente não encontrado');
    await this.prisma.$transaction([
      this.prisma.agenteIA.update({
        where: { id },
        data: {
          nome: dto.nome,
          descricao: dto.descricao,
          categoria: dto.categoria,
          icone: dto.icone,
          url: normalizarUrl(dto.url),
          todasTrilhas: dto.todasTrilhas ?? false,
        },
      }),
      this.prisma.agenteTrilha.deleteMany({ where: { agenteId: id } }),
      this.prisma.agenteTrilha.createMany({
        data: (dto.trilhaIds ?? []).map((trilhaId) => ({ agenteId: id, trilhaId })),
      }),
    ]);
    return { ok: true };
  }

  async removerTenant(contaId: string, id: string) {
    await this.prisma.agenteIA.deleteMany({ where: { id, contaId } });
    return { ok: true };
  }

  // ---------- Aluno ----------
  async listarParaAluno(user: AuthUser): Promise<AgentePublico[]> {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    const plataforma =
      conta?.tipoConta === 'corporativo'
        ? await this.prisma.agenteIA.findMany({ where: { proprietarioTipo: ProprietarioConteudo.plataforma, ativo: true } })
        : [];

    const tenant = await this.prisma.agenteIA.findMany({
      where: { proprietarioTipo: ProprietarioConteudo.tenant, contaId: user.contaId, ativo: true },
      include: { trilhas: true },
    });
    const mats = await this.prisma.matricula.findMany({
      where: {
        usuarioId: user.sub,
        contaId: user.contaId!,
        status: 'ativa',
        OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }],
      },
      select: { trilhaId: true },
    });
    const trilhaIds = new Set(mats.map((m) => m.trilhaId));
    const tenantVisiveis = tenant.filter((a) => a.todasTrilhas || a.trilhas.some((t) => trilhaIds.has(t.trilhaId)));

    return [...plataforma, ...tenantVisiveis].map((a) => this.publico(a));
  }

  async listarParaTrilha(user: AuthUser, trilhaId: string): Promise<AgentePublico[]> {
    const tenant = await this.prisma.agenteIA.findMany({
      where: { proprietarioTipo: ProprietarioConteudo.tenant, contaId: user.contaId, ativo: true },
      include: { trilhas: true },
    });
    return tenant
      .filter((a) => a.todasTrilhas || a.trilhas.some((t) => t.trilhaId === trilhaId))
      .map((a) => this.publico(a));
  }
}
