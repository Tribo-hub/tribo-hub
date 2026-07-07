import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanoEntregaStatus, PlanoItemTipo, Role, StatusMatricula } from '@tribohub/db';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { GamificacaoService } from '../gamificacao/gamificacao.service';
import { StorageService } from '../storage/storage.service';
import { AnaliseDto, AtualizarItemDto, AtualizarPlanoDto, CriarItemDto, CriarPlanoDto, ReordenarItensDto, ResponderItemDto } from './dto';

const DIA = 86_400_000;

@Injectable()
export class PlanosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificacao: GamificacaoService,
    private readonly storage: StorageService,
  ) {}

  // ============================ Produtor ============================
  async criarPlano(user: AuthUser, dto: CriarPlanoDto) {
    if (dto.trilhaId) await this.trilhaDaConta(user.contaId!, dto.trilhaId);
    if (dto.moduloId) await this.moduloDaConta(user.contaId!, dto.moduloId);
    const max = await this.prisma.planoAcao.aggregate({ where: { contaId: user.contaId! }, _max: { ordem: true } });
    return this.prisma.planoAcao.create({
      data: {
        contaId: user.contaId!,
        titulo: dto.titulo,
        subtitulo: dto.subtitulo ?? null,
        descricao: dto.descricao ?? null,
        capaUrl: dto.capaUrl ?? null,
        trilhaId: dto.trilhaId ?? null,
        moduloId: dto.moduloId ?? null,
        prazoEm: dto.prazoEm ? new Date(dto.prazoEm) : null,
        releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : null,
        agendamento: dto.agendamento ?? 'fixo',
        liberaAposDias: dto.liberaAposDias ?? null,
        prazoDias: dto.prazoDias ?? null,
        xpEntrega: dto.xpEntrega ?? 0,
        penalizarAtraso: dto.penalizarAtraso ?? false,
        penalidadeAtrasoPct: dto.penalidadeAtrasoPct ?? null,
        analiseAtiva: dto.analiseAtiva ?? false,
        ordem: (max._max.ordem ?? 0) + 1,
      },
    });
  }

  async atualizarPlano(user: AuthUser, id: string, dto: AtualizarPlanoDto) {
    await this.planoDaConta(user.contaId!, id);
    return this.prisma.planoAcao.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.subtitulo !== undefined ? { subtitulo: dto.subtitulo || null } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao || null } : {}),
        ...(dto.capaUrl !== undefined ? { capaUrl: dto.capaUrl || null } : {}),
        ...(dto.prazoEm !== undefined ? { prazoEm: dto.prazoEm ? new Date(dto.prazoEm) : null } : {}),
        ...(dto.releasedAt !== undefined ? { releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : null } : {}),
        ...(dto.agendamento !== undefined ? { agendamento: dto.agendamento } : {}),
        ...(dto.liberaAposDias !== undefined ? { liberaAposDias: dto.liberaAposDias } : {}),
        ...(dto.prazoDias !== undefined ? { prazoDias: dto.prazoDias } : {}),
        ...(dto.xpEntrega !== undefined ? { xpEntrega: dto.xpEntrega } : {}),
        ...(dto.penalizarAtraso !== undefined ? { penalizarAtraso: dto.penalizarAtraso } : {}),
        ...(dto.penalidadeAtrasoPct !== undefined ? { penalidadeAtrasoPct: dto.penalidadeAtrasoPct } : {}),
        ...(dto.analiseAtiva !== undefined ? { analiseAtiva: dto.analiseAtiva } : {}),
      },
    });
  }

  async listarPlanos(user: AuthUser) {
    const planos = await this.prisma.planoAcao.findMany({
      where: { contaId: user.contaId! },
      orderBy: [{ ordem: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { itens: true, entregas: true } } },
    });
    const ids = planos.map((p) => p.trilhaId).filter((x): x is string => !!x);
    const trilhas = ids.length
      ? await this.prisma.trilha.findMany({ where: { id: { in: ids } }, select: { id: true, titulo: true } })
      : [];
    const nome = new Map(trilhas.map((t) => [t.id, t.titulo]));
    return planos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      subtitulo: p.subtitulo,
      ordem: p.ordem,
      descricao: p.descricao,
      trilhaId: p.trilhaId,
      moduloId: p.moduloId,
      trilhaTitulo: p.trilhaId ? nome.get(p.trilhaId) ?? null : null,
      agendamento: p.agendamento ?? 'fixo',
      totalItens: p._count.itens,
      entregas: p._count.entregas,
    }));
  }

  // Detalhe + acompanhamento (quem está em dia / atrasado / entregou).
  async obterPlano(user: AuthUser, id: string) {
    const plano = await this.planoDaConta(user.contaId!, id);
    const itens = await this.prisma.planoItem.findMany({ where: { planoId: id }, orderBy: { ordem: 'asc' } });
    const aulasMap = await this.aulasDosItens(itens);

    const alunos = await this.alunosAudiencia(user.contaId!, plano.trilhaId);
    const alunoIds = alunos.map((a) => a.id);
    const itemIds = itens.map((i) => i.id);
    const progresso = itemIds.length
      ? await this.prisma.planoItemProgresso.findMany({ where: { itemId: { in: itemIds } } })
      : [];
    const assistidos = await this.aulasConcluidasPorAluno(itens, alunoIds);
    const entregas = await this.prisma.planoEntrega.findMany({ where: { planoId: id } });
    const entregaMap = new Map(entregas.map((e) => [e.usuarioId, e]));

    const itemConcluido = (it: (typeof itens)[number], usuarioId: string) =>
      it.tipo === PlanoItemTipo.assistir
        ? !!(it.aulaId && assistidos.get(usuarioId)?.has(it.aulaId))
        : progresso.some((p) => p.itemId === it.id && p.usuarioId === usuarioId && p.concluido);

    const agora = Date.now();
    const ancoras = await this.resolverAncoras(plano, alunoIds);
    const acompanhamento = alunos.map((a) => {
      const anchor = ancoras.get(a.id) ?? null;
      const concluidos = itens.filter((it) => itemConcluido(it, a.id)).length;
      const atrasados = itens.filter((it) => {
        const pr = this.prazoItem(plano, it, anchor);
        return pr && pr.getTime() < agora && !itemConcluido(it, a.id);
      }).length;
      const e = entregaMap.get(a.id);
      return {
        id: a.id,
        nome: a.nome,
        email: a.email,
        totalItens: itens.length,
        concluidos,
        atrasados,
        emDia: atrasados === 0,
        percentual: itens.length ? Math.round((concluidos / itens.length) * 100) : 0,
        entregue: !!e,
        entregaStatus: e?.status ?? null,
        submittedAt: e?.submittedAt ?? null,
        diasAntesDoPrazo: e?.diasAntesDoPrazo ?? null,
      };
    });

    return {
      id: plano.id,
      titulo: plano.titulo,
      subtitulo: plano.subtitulo,
      descricao: plano.descricao,
      capaUrl: plano.capaUrl,
      ordem: plano.ordem,
      prazoEm: plano.prazoEm,
      releasedAt: plano.releasedAt,
      agendamento: plano.agendamento ?? 'fixo',
      liberaAposDias: plano.liberaAposDias,
      prazoDias: plano.prazoDias,
      xpEntrega: plano.xpEntrega,
      penalizarAtraso: plano.penalizarAtraso,
      penalidadeAtrasoPct: plano.penalidadeAtrasoPct,
      analiseAtiva: plano.analiseAtiva,
      trilhaId: plano.trilhaId,
      moduloId: plano.moduloId,
      itens: itens.map((i) => ({
        id: i.id,
        titulo: i.titulo,
        descricao: i.descricao,
        tipo: i.tipo,
        prazoEm: i.prazoEm,
        prazoDias: i.prazoDias,
        ordem: i.ordem,
        aula: i.aulaId ? aulasMap.get(i.aulaId) ?? null : null,
      })),
      acompanhamento,
    };
  }

  // Detalhe do progresso de UM aluno (o que cumpriu / falta + entregas + análise).
  async detalheAluno(user: AuthUser, planoId: string, usuarioId: string) {
    const plano = await this.planoDaConta(user.contaId!, planoId);
    const aluno = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, contaId: user.contaId! },
      select: { id: true, nome: true, email: true },
    });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');

    const itens = await this.prisma.planoItem.findMany({ where: { planoId }, orderBy: { ordem: 'asc' } });
    const aulasMap = await this.aulasDosItens(itens);
    const progresso = await this.prisma.planoItemProgresso.findMany({
      where: { itemId: { in: itens.map((i) => i.id) }, usuarioId },
    });
    const pmap = new Map(progresso.map((p) => [p.itemId, p]));
    const assistidos = (await this.aulasConcluidasPorAluno(itens, [usuarioId])).get(usuarioId) ?? new Set<string>();
    const entrega = await this.prisma.planoEntrega.findUnique({ where: { planoId_usuarioId: { planoId, usuarioId } } });
    const agora = Date.now();
    const anchor = await this.ancoraDoAluno(plano, usuarioId);
    const dPlano = this.datasPlano(plano, anchor);

    return {
      aluno,
      plano: { id: plano.id, titulo: plano.titulo, analiseAtiva: plano.analiseAtiva, prazoEm: dPlano.prazoEm },
      entrega: entrega
        ? {
            status: entrega.status,
            submittedAt: entrega.submittedAt,
            diasAntesDoPrazo: entrega.diasAntesDoPrazo,
            analiseTexto: entrega.analiseTexto,
            analiseEm: entrega.analiseEm,
          }
        : null,
      itens: itens.map((it) => {
        const p = pmap.get(it.id);
        const concluido = it.tipo === PlanoItemTipo.assistir ? !!(it.aulaId && assistidos.has(it.aulaId)) : !!p?.concluido;
        const prItem = this.prazoItem(plano, it, anchor);
        return {
          id: it.id,
          titulo: it.titulo,
          tipo: it.tipo,
          aula: it.aulaId ? aulasMap.get(it.aulaId) ?? null : null,
          prazoEm: prItem,
          concluido,
          texto: p?.texto ?? null,
          links: this.lerLinks(p?.links),
          concluidoEm: p?.concluidoEm ?? null,
          atrasado: !concluido && !!prItem && prItem.getTime() < agora,
        };
      }),
    };
  }

  async definirAnalise(user: AuthUser, planoId: string, usuarioId: string, dto: AnaliseDto) {
    const plano = await this.planoDaConta(user.contaId!, planoId);
    if (!plano.analiseAtiva) throw new BadRequestException('A análise não está ativa neste plano.');
    const entrega = await this.prisma.planoEntrega.findUnique({ where: { planoId_usuarioId: { planoId, usuarioId } } });
    if (!entrega) throw new BadRequestException('O aluno ainda não entregou este plano.');
    return this.prisma.planoEntrega.update({
      where: { planoId_usuarioId: { planoId, usuarioId } },
      data: { analiseTexto: dto.texto, analiseEm: new Date(), status: PlanoEntregaStatus.reviewed },
    });
  }

  async removerPlano(user: AuthUser, id: string) {
    await this.planoDaConta(user.contaId!, id);
    await this.prisma.planoAcao.delete({ where: { id } });
    return { ok: true };
  }

  async adicionarItem(user: AuthUser, planoId: string, dto: CriarItemDto) {
    await this.planoDaConta(user.contaId!, planoId);
    const tipo = dto.tipo ?? PlanoItemTipo.check;
    const precisaAula = tipo === PlanoItemTipo.assistir || tipo === PlanoItemTipo.resumo;
    if (precisaAula) {
      if (!dto.aulaId) throw new ForbiddenException('Selecione a aula para este tipo de tarefa');
      await this.aulaDaConta(user.contaId!, dto.aulaId);
    }
    const max = await this.prisma.planoItem.aggregate({ where: { planoId }, _max: { ordem: true } });
    return this.prisma.planoItem.create({
      data: {
        planoId,
        titulo: dto.titulo,
        descricao: dto.descricao ?? null,
        tipo,
        aulaId: precisaAula ? dto.aulaId ?? null : null,
        prazoEm: dto.prazoEm ? new Date(dto.prazoEm) : null,
        prazoDias: dto.prazoDias ?? null,
        ordem: (max._max.ordem ?? 0) + 1,
      },
    });
  }

  async atualizarItem(user: AuthUser, itemId: string, dto: AtualizarItemDto) {
    const item = await this.itemDaConta(user.contaId!, itemId);
    return this.prisma.planoItem.update({
      where: { id: item.id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao || null } : {}),
        ...(dto.prazoEm !== undefined ? { prazoEm: dto.prazoEm ? new Date(dto.prazoEm) : null } : {}),
        ...(dto.prazoDias !== undefined ? { prazoDias: dto.prazoDias } : {}),
      },
    });
  }

  async reordenarItens(user: AuthUser, planoId: string, dto: ReordenarItensDto) {
    await this.planoDaConta(user.contaId!, planoId);
    const itens = await this.prisma.planoItem.findMany({ where: { planoId }, select: { id: true } });
    const validos = new Set(itens.map((i) => i.id));
    await this.prisma.$transaction(
      dto.ids
        .filter((id) => validos.has(id))
        .map((id, idx) => this.prisma.planoItem.update({ where: { id }, data: { ordem: idx + 1 } })),
    );
    return { ok: true };
  }

  async removerItem(user: AuthUser, itemId: string) {
    const item = await this.itemDaConta(user.contaId!, itemId);
    await this.prisma.planoItem.delete({ where: { id: item.id } });
    return { ok: true };
  }

  // ============================ Aluno ============================
  // Cards da listagem (leve): progresso + countdown + estado de entrega.
  async meusPlanos(user: AuthUser) {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    if (!conta || !conta.ativo || !conta.planosAtivos) return [];

    const minhas = await this.minhasTrilhas(user);
    const planos = await this.prisma.planoAcao.findMany({
      where: { contaId: user.contaId!, OR: [{ trilhaId: null }, { trilhaId: { in: minhas } }] },
      orderBy: [{ ordem: 'asc' }, { createdAt: 'desc' }],
      include: { itens: true },
    });

    const todosItens = planos.flatMap((p) => p.itens);
    const progresso = todosItens.length
      ? await this.prisma.planoItemProgresso.findMany({ where: { itemId: { in: todosItens.map((i) => i.id) }, usuarioId: user.sub } })
      : [];
    const pmap = new Map(progresso.map((p) => [p.itemId, p]));
    const assistidos = (await this.aulasConcluidasPorAluno(todosItens, [user.sub])).get(user.sub) ?? new Set<string>();
    const entregas = await this.prisma.planoEntrega.findMany({ where: { planoId: { in: planos.map((p) => p.id) }, usuarioId: user.sub } });
    const entregaMap = new Map(entregas.map((e) => [e.planoId, e]));
    const agora = Date.now();

    return Promise.all(
      planos.map(async (p) => {
        const concluidos = p.itens.filter((i) => this.concluidoLocal(i, pmap, assistidos)).length;
        const e = entregaMap.get(p.id);
        const anchor = await this.ancoraDoAluno(p, user.sub);
        const { releasedAt, prazoEm } = this.datasPlano(p, anchor);
        return {
          id: p.id,
          titulo: p.titulo,
          subtitulo: p.subtitulo,
          ordem: p.ordem,
          trilhaId: p.trilhaId,
          capaUrl: await this.assinarSeArquivo(p.capaUrl),
          prazoEm,
          releasedAt,
          bloqueado: !!releasedAt && releasedAt.getTime() > agora,
          totalItens: p.itens.length,
          concluidos,
          percentual: p.itens.length ? Math.round((concluidos / p.itens.length) * 100) : 0,
          analiseAtiva: p.analiseAtiva,
          entregue: !!e,
          entregaStatus: e?.status ?? null,
          diasAntesDoPrazo: e?.diasAntesDoPrazo ?? null,
          temAnalise: !!e?.analiseTexto,
        };
      }),
    );
  }

  // Detalhe completo de um plano para o aluno.
  async obterPlanoAluno(user: AuthUser, planoId: string) {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    if (!conta || !conta.ativo || !conta.planosAtivos) throw new NotFoundException('Plano não encontrado');
    const plano = await this.prisma.planoAcao.findFirst({ where: { id: planoId, contaId: user.contaId! }, include: { itens: { orderBy: { ordem: 'asc' } } } });
    if (!plano) throw new NotFoundException('Plano não encontrado');
    if (plano.trilhaId) {
      const minhas = await this.minhasTrilhas(user);
      if (!minhas.includes(plano.trilhaId)) throw new ForbiddenException('Plano não disponível');
    }

    const aulasMap = await this.aulasDosItens(plano.itens);
    const progresso = plano.itens.length
      ? await this.prisma.planoItemProgresso.findMany({ where: { itemId: { in: plano.itens.map((i) => i.id) }, usuarioId: user.sub } })
      : [];
    const pmap = new Map(progresso.map((p) => [p.itemId, p]));
    const assistidos = (await this.aulasConcluidasPorAluno(plano.itens, [user.sub])).get(user.sub) ?? new Set<string>();
    const entrega = await this.prisma.planoEntrega.findUnique({ where: { planoId_usuarioId: { planoId, usuarioId: user.sub } } });
    const agora = Date.now();
    const anchor = await this.ancoraDoAluno(plano, user.sub);
    const dPlano = this.datasPlano(plano, anchor);
    const bloqueado = !!dPlano.releasedAt && dPlano.releasedAt.getTime() > agora;

    const itens = plano.itens.map((i) => {
      const pr = pmap.get(i.id);
      const concluido = this.concluidoLocal(i, pmap, assistidos);
      return {
        id: i.id,
        titulo: i.titulo,
        descricao: i.descricao,
        tipo: i.tipo,
        prazoEm: this.prazoItem(plano, i, anchor),
        concluido,
        texto: pr?.texto ?? '',
        links: this.lerLinks(pr?.links),
        aula: i.aulaId ? aulasMap.get(i.aulaId) ?? null : null,
      };
    });
    const concluidos = itens.filter((i) => i.concluido).length;

    return {
      id: plano.id,
      titulo: plano.titulo,
      subtitulo: plano.subtitulo,
      descricao: plano.descricao,
      ordem: plano.ordem,
      capaUrl: await this.assinarSeArquivo(plano.capaUrl),
      prazoEm: dPlano.prazoEm,
      releasedAt: dPlano.releasedAt,
      bloqueado,
      analiseAtiva: plano.analiseAtiva,
      totalItens: itens.length,
      concluidos,
      percentual: itens.length ? Math.round((concluidos / itens.length) * 100) : 0,
      podeEntregar: !bloqueado && itens.length > 0 && concluidos === itens.length && !entrega,
      entrega: entrega
        ? {
            status: entrega.status,
            submittedAt: entrega.submittedAt,
            diasAntesDoPrazo: entrega.diasAntesDoPrazo,
            analiseTexto: entrega.analiseTexto,
          }
        : null,
      itens,
    };
  }

  async responderItem(user: AuthUser, itemId: string, dto: ResponderItemDto) {
    const item = await this.prisma.planoItem.findUnique({ where: { id: itemId }, include: { plano: true } });
    if (!item || item.plano.contaId !== user.contaId) throw new NotFoundException('Item não encontrado');
    const ancoraResp = await this.ancoraDoAluno(item.plano, user.sub);
    const liberacaoResp = this.datasPlano(item.plano, ancoraResp).releasedAt;
    if (liberacaoResp && liberacaoResp.getTime() > Date.now()) throw new ForbiddenException('Plano ainda não liberado');
    if (item.plano.trilhaId) {
      const mat = await this.prisma.matricula.findFirst({
        where: { usuarioId: user.sub, trilhaId: item.plano.trilhaId, status: StatusMatricula.ativa },
      });
      if (!mat) throw new ForbiddenException('Plano não disponível');
    }
    // Já entregue? Trava edições.
    const entrega = await this.prisma.planoEntrega.findUnique({ where: { planoId_usuarioId: { planoId: item.planoId, usuarioId: user.sub } } });
    if (entrega) throw new ForbiddenException('Plano já entregue — não é possível alterar as tarefas.');

    // "assistir" conclui ao concluir a aula — não é marcado manualmente.
    if (item.tipo === PlanoItemTipo.assistir) return { ok: true };

    let concluido: boolean;
    let texto: string | null = null;
    let links: string[] | null = null;
    if (item.tipo === PlanoItemTipo.resumo) {
      texto = (dto.texto ?? '').trim();
      concluido = !!texto;
    } else if (item.tipo === PlanoItemTipo.link) {
      links = (dto.links ?? []).map((l) => l.trim()).filter(Boolean);
      concluido = links.length > 0;
    } else {
      concluido = dto.concluido ?? false;
    }
    await this.prisma.planoItemProgresso.upsert({
      where: { itemId_usuarioId: { itemId, usuarioId: user.sub } },
      create: { itemId, usuarioId: user.sub, contaId: user.contaId!, concluido, texto, links: links ?? undefined, concluidoEm: concluido ? new Date() : null },
      update: { concluido, texto, links: links ?? undefined, concluidoEm: concluido ? new Date() : null },
    });
    if (concluido) await this.gamificacao.registrar(user, 'plano_item', itemId);
    return { ok: true, concluido };
  }

  // Entrega do plano completo (gate de 100%).
  async entregarPlano(user: AuthUser, planoId: string) {
    const plano = await this.prisma.planoAcao.findFirst({ where: { id: planoId, contaId: user.contaId! }, include: { itens: true } });
    if (!plano) throw new NotFoundException('Plano não encontrado');
    const ancoraEntrega = await this.ancoraDoAluno(plano, user.sub);
    const dEntrega = this.datasPlano(plano, ancoraEntrega);
    if (dEntrega.releasedAt && dEntrega.releasedAt.getTime() > Date.now()) throw new ForbiddenException('Plano ainda não liberado');
    if (plano.trilhaId) {
      const minhas = await this.minhasTrilhas(user);
      if (!minhas.includes(plano.trilhaId)) throw new ForbiddenException('Plano não disponível');
    }
    const existente = await this.prisma.planoEntrega.findUnique({ where: { planoId_usuarioId: { planoId, usuarioId: user.sub } } });
    if (existente) throw new BadRequestException('Plano já entregue.');

    if (plano.itens.length === 0) throw new BadRequestException('Plano sem tarefas.');
    const progresso = await this.prisma.planoItemProgresso.findMany({ where: { itemId: { in: plano.itens.map((i) => i.id) }, usuarioId: user.sub } });
    const pmap = new Map(progresso.map((p) => [p.itemId, p]));
    const assistidos = (await this.aulasConcluidasPorAluno(plano.itens, [user.sub])).get(user.sub) ?? new Set<string>();
    const todosFeitos = plano.itens.every((i) => this.concluidoLocal(i, pmap, assistidos));
    if (!todosFeitos) throw new BadRequestException('Conclua todas as tarefas antes de entregar o plano.');

    const diasAntesDoPrazo = dEntrega.prazoEm ? Math.floor((dEntrega.prazoEm.getTime() - Date.now()) / DIA) : null;
    const entrega = await this.prisma.planoEntrega.create({
      data: { planoId, usuarioId: user.sub, contaId: user.contaId!, status: PlanoEntregaStatus.submitted, diasAntesDoPrazo },
    });

    // XP da entrega (com redução opcional se entregue fora do prazo)
    if (plano.xpEntrega > 0) {
      const atrasado = diasAntesDoPrazo != null && diasAntesDoPrazo < 0;
      const fator = atrasado && plano.penalizarAtraso ? Math.max(0, 1 - (plano.penalidadeAtrasoPct ?? 0) / 100) : 1;
      await this.gamificacao.registrarXp(user, 'plano_entrega', planoId, plano.xpEntrega * fator, plano.trilhaId);
    }
    return { ok: true, status: entrega.status, diasAntesDoPrazo };
  }

  // ============================ Helpers ============================
  private concluidoLocal(
    item: { id: string; tipo: PlanoItemTipo; aulaId: string | null },
    pmap: Map<string, { concluido: boolean }>,
    assistidos: Set<string>,
  ) {
    if (item.tipo === PlanoItemTipo.assistir) return !!(item.aulaId && assistidos.has(item.aulaId));
    return !!pmap.get(item.id)?.concluido;
  }

  private lerLinks(v: unknown): string[] {
    return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  }

  private async assinarSeArquivo(url: string | null): Promise<string | null> {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    try {
      return (await this.storage.urlDeDownload(url)).url;
    } catch {
      return null;
    }
  }

  private async minhasTrilhas(user: AuthUser): Promise<string[]> {
    const mats = await this.prisma.matricula.findMany({
      where: {
        usuarioId: user.sub,
        contaId: user.contaId!,
        status: StatusMatricula.ativa,
        OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }],
      },
      select: { trilhaId: true },
    });
    return mats.map((m) => m.trilhaId);
  }

  private async aulasDosItens(itens: { aulaId: string | null }[]) {
    const ids = [...new Set(itens.map((i) => i.aulaId).filter((x): x is string => !!x))];
    if (!ids.length) return new Map<string, { id: string; titulo: string; trilhaId: string }>();
    const aulas = await this.prisma.aula.findMany({
      where: { id: { in: ids } },
      select: { id: true, titulo: true, modulo: { select: { trilhaId: true } } },
    });
    return new Map(aulas.map((a) => [a.id, { id: a.id, titulo: a.titulo, trilhaId: a.modulo.trilhaId }]));
  }

  private async aulasConcluidasPorAluno(itens: { tipo: PlanoItemTipo; aulaId: string | null }[], usuarioIds: string[]) {
    const aulaIds = [...new Set(itens.filter((i) => i.tipo === PlanoItemTipo.assistir && i.aulaId).map((i) => i.aulaId as string))];
    const map = new Map<string, Set<string>>();
    if (!aulaIds.length || !usuarioIds.length) return map;
    const progressos = await this.prisma.progresso.findMany({
      where: { usuarioId: { in: usuarioIds }, aulaId: { in: aulaIds }, concluido: true },
      select: { usuarioId: true, aulaId: true },
    });
    for (const p of progressos) {
      if (!map.has(p.usuarioId)) map.set(p.usuarioId, new Set());
      map.get(p.usuarioId)!.add(p.aulaId);
    }
    return map;
  }

  private async alunosAudiencia(contaId: string, trilhaId: string | null) {
    if (trilhaId) {
      const mats = await this.prisma.matricula.findMany({
        where: { contaId, trilhaId, status: StatusMatricula.ativa },
        select: { usuario: { select: { id: true, nome: true, email: true } } },
      });
      const map = new Map(mats.map((m) => [m.usuario.id, m.usuario]));
      return [...map.values()];
    }
    return this.prisma.usuario.findMany({
      where: { contaId, role: Role.aluno, ativo: true },
      select: { id: true, nome: true, email: true },
    });
  }

  // ===== Agendamento relativo (D+N) — âncora por aluno (turma/drip/matrícula) =====
  private async resolverAncoras(plano: { contaId: string; trilhaId: string | null }, usuarioIds: string[]): Promise<Map<string, Date>> {
    const map = new Map<string, Date>();
    if (usuarioIds.length === 0) return map;
    if (plano.trilhaId) {
      const trilha = await this.prisma.trilha.findUnique({
        where: { id: plano.trilhaId },
        select: { usaTurmas: true, dripBase: true, dripInicioEm: true },
      });
      if (trilha?.usaTurmas) {
        const mats = await this.prisma.matricula.findMany({
          where: { trilhaId: plano.trilhaId, usuarioId: { in: usuarioIds } },
          select: { usuarioId: true, createdAt: true, turma: { select: { inicioEm: true } } },
        });
        for (const m of mats) map.set(m.usuarioId, m.turma?.inicioEm ?? m.createdAt);
      } else if (trilha?.dripBase === 'fixa' && trilha.dripInicioEm) {
        for (const id of usuarioIds) map.set(id, trilha.dripInicioEm);
      } else {
        const mats = await this.prisma.matricula.findMany({
          where: { trilhaId: plano.trilhaId, usuarioId: { in: usuarioIds } },
          select: { usuarioId: true, createdAt: true },
        });
        for (const m of mats) map.set(m.usuarioId, m.createdAt);
      }
    } else {
      const mats = await this.prisma.matricula.findMany({
        where: { contaId: plano.contaId, usuarioId: { in: usuarioIds } },
        select: { usuarioId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      for (const m of mats) if (!map.has(m.usuarioId)) map.set(m.usuarioId, m.createdAt);
    }
    const faltam = usuarioIds.filter((id) => !map.has(id));
    if (faltam.length) {
      const us = await this.prisma.usuario.findMany({ where: { id: { in: faltam } }, select: { id: true, createdAt: true } });
      for (const u of us) map.set(u.id, u.createdAt);
    }
    return map;
  }

  private async ancoraDoAluno(plano: { contaId: string; trilhaId: string | null }, usuarioId: string): Promise<Date | null> {
    return (await this.resolverAncoras(plano, [usuarioId])).get(usuarioId) ?? null;
  }

  // Datas efetivas do plano (modo fixo usa as datas salvas; relativo calcula a partir da âncora).
  private datasPlano(
    plano: { agendamento: string | null; releasedAt: Date | null; prazoEm: Date | null; liberaAposDias: number | null; prazoDias: number | null },
    anchor: Date | null,
  ): { releasedAt: Date | null; prazoEm: Date | null } {
    if (plano.agendamento !== 'relativo') return { releasedAt: plano.releasedAt, prazoEm: plano.prazoEm };
    return {
      releasedAt: anchor && plano.liberaAposDias != null ? new Date(anchor.getTime() + plano.liberaAposDias * DIA) : null,
      prazoEm: anchor && plano.prazoDias != null ? new Date(anchor.getTime() + plano.prazoDias * DIA) : null,
    };
  }

  private prazoItem(plano: { agendamento: string | null }, item: { prazoEm: Date | null; prazoDias: number | null }, anchor: Date | null): Date | null {
    if (plano.agendamento !== 'relativo') return item.prazoEm;
    return anchor && item.prazoDias != null ? new Date(anchor.getTime() + item.prazoDias * DIA) : null;
  }

  private async planoDaConta(contaId: string, id: string) {
    const p = await this.prisma.planoAcao.findFirst({ where: { id, contaId } });
    if (!p) throw new NotFoundException('Plano não encontrado');
    return p;
  }

  private async itemDaConta(contaId: string, itemId: string) {
    const item = await this.prisma.planoItem.findUnique({ where: { id: itemId }, include: { plano: true } });
    if (!item || item.plano.contaId !== contaId) throw new NotFoundException('Item não encontrado');
    return item;
  }

  private async trilhaDaConta(contaId: string, trilhaId: string) {
    const t = await this.prisma.trilha.findFirst({ where: { id: trilhaId, contaId, deletedAt: null } });
    if (!t) throw new ForbiddenException('Trilha não encontrada nesta conta');
    return t;
  }

  private async moduloDaConta(contaId: string, moduloId: string) {
    const m = await this.prisma.modulo.findFirst({ where: { id: moduloId, trilha: { contaId, deletedAt: null } } });
    if (!m) throw new ForbiddenException('Módulo não encontrado nesta conta');
    return m;
  }

  private async aulaDaConta(contaId: string, aulaId: string) {
    const a = await this.prisma.aula.findFirst({ where: { id: aulaId, modulo: { trilha: { contaId } } } });
    if (!a) throw new ForbiddenException('Aula não encontrada nesta conta');
    return a;
  }
}
