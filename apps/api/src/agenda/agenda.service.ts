import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusMatricula } from '@tribohub/db';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarEventoDto, CriarEventoDto } from './dto';

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Produtor ----------
  async criar(user: AuthUser, dto: CriarEventoDto) {
    if (dto.trilhaId) await this.trilhaDaConta(user.contaId!, dto.trilhaId);
    return this.prisma.eventoAoVivo.create({
      data: {
        contaId: user.contaId!,
        titulo: dto.titulo,
        descricao: dto.descricao,
        linkAcesso: dto.linkAcesso,
        inicioEm: new Date(dto.inicioEm),
        duracaoMin: dto.duracaoMin ?? 60,
        trilhaId: dto.trilhaId ?? null,
      },
    });
  }

  async listar(user: AuthUser) {
    const eventos = await this.prisma.eventoAoVivo.findMany({
      where: { contaId: user.contaId! },
      orderBy: { inicioEm: 'desc' },
    });
    return this.comNomeTrilha(eventos);
  }

  async atualizar(user: AuthUser, id: string, dto: AtualizarEventoDto) {
    await this.eventoDaConta(user.contaId!, id);
    if (dto.trilhaId) await this.trilhaDaConta(user.contaId!, dto.trilhaId);
    return this.prisma.eventoAoVivo.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        linkAcesso: dto.linkAcesso,
        inicioEm: dto.inicioEm ? new Date(dto.inicioEm) : undefined,
        duracaoMin: dto.duracaoMin,
        ...(dto.trilhaId !== undefined ? { trilhaId: dto.trilhaId } : {}),
      },
    });
  }

  async remover(user: AuthUser, id: string) {
    await this.eventoDaConta(user.contaId!, id);
    await this.prisma.eventoAoVivo.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Aluno ----------
  async agendaDoAluno(user: AuthUser) {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    if (!conta || !conta.ativo || !conta.agendaAtiva) return [];

    // trilhas com matrícula ativa (para filtrar eventos restritos)
    const mats = await this.prisma.matricula.findMany({
      where: {
        usuarioId: user.sub,
        contaId: user.contaId!,
        status: StatusMatricula.ativa,
        OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }],
      },
      select: { trilhaId: true },
    });
    const minhas = new Set(mats.map((m) => m.trilhaId));

    // próximos e em andamento (fim no futuro)
    const agora = Date.now();
    const eventos = await this.prisma.eventoAoVivo.findMany({
      where: { contaId: user.contaId! },
      orderBy: { inicioEm: 'asc' },
    });
    const visiveis = eventos.filter((e) => {
      const fim = e.inicioEm.getTime() + e.duracaoMin * 60_000;
      if (fim < agora) return false; // já terminou
      if (e.trilhaId && !minhas.has(e.trilhaId)) return false; // restrito a outra trilha
      return true;
    });
    return this.comNomeTrilha(visiveis);
  }

  // ---------- Helpers ----------
  private async comNomeTrilha<T extends { trilhaId: string | null }>(eventos: T[]) {
    const ids = [...new Set(eventos.map((e) => e.trilhaId).filter((x): x is string => !!x))];
    const trilhas = ids.length
      ? await this.prisma.trilha.findMany({ where: { id: { in: ids } }, select: { id: true, titulo: true } })
      : [];
    const nome = new Map(trilhas.map((t) => [t.id, t.titulo]));
    return eventos.map((e) => ({ ...e, trilhaTitulo: e.trilhaId ? nome.get(e.trilhaId) ?? null : null }));
  }

  private async eventoDaConta(contaId: string, id: string) {
    const e = await this.prisma.eventoAoVivo.findFirst({ where: { id, contaId } });
    if (!e) throw new NotFoundException('Evento não encontrado');
    return e;
  }

  private async trilhaDaConta(contaId: string, trilhaId: string) {
    const t = await this.prisma.trilha.findFirst({ where: { id: trilhaId, contaId, deletedAt: null } });
    if (!t) throw new ForbiddenException('Trilha não encontrada nesta conta');
    return t;
  }
}
