import { Injectable } from '@nestjs/common';
import { StatusMatricula } from '@tribohub/db';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PlanosService } from '../planos/planos.service';
import { GamificacaoService } from '../gamificacao/gamificacao.service';

// Fonte ÚNICA da home do aluno (jornada). As duas visões do front (Missão em foco / Linha do
// tempo) consomem exatamente este payload — garante que mostrem as mesmas coisas.
@Injectable()
export class JornadaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanosService,
    private readonly gamificacao: GamificacaoService,
  ) {}

  async jornada(user: AuthUser, selParam?: string) {
    const conta = await this.prisma.conta.findUnique({
      where: { id: user.contaId! },
      select: { agendaAtiva: true, planosAtivos: true },
    });

    // Trilhas do aluno (matrículas ativas) — alimentam o seletor.
    const mats = await this.prisma.matricula.findMany({
      where: {
        usuarioId: user.sub,
        contaId: user.contaId!,
        status: StatusMatricula.ativa,
        OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }],
      },
      select: { trilha: { select: { id: true, titulo: true } } },
    });
    const trilhas = [...new Map(mats.map((m) => [m.trilha.id, m.trilha])).values()];

    // Planos do aluno (todos, já com status/percentual/bloqueio calculados).
    const planosTodos = conta?.planosAtivos ? await this.planos.meusPlanos(user) : [];
    const trilhasComPlano = new Set(planosTodos.filter((p) => p.trilhaId).map((p) => p.trilhaId as string));
    const temGeral = planosTodos.some((p) => !p.trilhaId);

    const opcoes: { valor: string; label: string; temPlanos: boolean }[] = trilhas.map((t) => ({
      valor: t.id,
      label: t.titulo,
      temPlanos: trilhasComPlano.has(t.id),
    }));
    if (temGeral) opcoes.unshift({ valor: 'geral', label: 'Geral', temPlanos: true });

    // Resolve a seleção: parâmetro válido; senão a 1ª com planos; senão a 1ª.
    let sel = selParam && opcoes.some((o) => o.valor === selParam) ? selParam : '';
    if (!sel) sel = (opcoes.find((o) => o.temPlanos) ?? opcoes[0])?.valor ?? '';

    const resumo = await this.gamificacao.resumo(user).catch(() => null);
    const gl = (resumo as { global?: { nivel: number; xp: number } } | null)?.global;
    const nivel = gl?.nivel ?? null;
    const xp = gl?.xp ?? null;
    const proximaLive = conta?.agendaAtiva ? await this.proximaLive(user.contaId!, sel) : null;

    const temPlanos = !!opcoes.find((o) => o.valor === sel)?.temPlanos;
    if (!temPlanos) {
      return { opcoes, sel, temPlanos: false, nivel, xp, proximaLive, planos: [], percentualJornada: 0, atual: null, proximoPasso: null };
    }

    const agora = Date.now();
    const planosSel = planosTodos
      .filter((p) => (sel === 'geral' ? !p.trilhaId : p.trilhaId === sel))
      .map((p) => {
        let status: string;
        if (p.entregue) status = 'entregue';
        else if (p.bloqueado) status = 'bloqueado';
        else if (p.prazoEm && new Date(p.prazoEm).getTime() < agora) status = 'atrasado';
        else if (p.percentual > 0) status = 'em_andamento';
        else status = 'disponivel';
        return { ...p, status };
      });

    const concluidos = planosSel.filter((p) => p.entregue).length;
    const percentualJornada = planosSel.length ? Math.round((concluidos / planosSel.length) * 100) : 0;

    // Plano atual = primeiro não entregue e não bloqueado.
    const atualCard = planosSel.find((p) => !p.entregue && !p.bloqueado) ?? null;
    let atual: unknown = null;
    let proximoPasso: unknown = null;

    if (atualCard) {
      const det = await this.planos.obterPlanoAluno(user, atualCard.id).catch(() => null);
      if (det) {
        atual = {
          id: det.id,
          titulo: det.titulo,
          subtitulo: det.subtitulo,
          prazoEm: det.prazoEm,
          totalItens: det.totalItens,
          concluidos: det.concluidos,
          percentual: det.percentual,
          itens: det.itens.map((i) => ({
            id: i.id,
            titulo: i.titulo,
            tipo: i.tipo,
            concluido: i.concluido,
            aulaId: i.aula?.id ?? null,
            aulaTrilhaId: i.aula?.trilhaId ?? null,
          })),
        };
        const pend = det.itens.find((i) => !i.concluido);
        if (pend && (pend.tipo === 'assistir' || pend.tipo === 'resumo') && pend.aula) {
          proximoPasso = { label: pend.titulo, kind: 'aula', aulaId: pend.aula.id, trilhaId: pend.aula.trilhaId, planoId: det.id };
        } else if (pend) {
          proximoPasso = { label: pend.titulo, kind: 'plano', planoId: det.id };
        } else {
          proximoPasso = { label: 'Entregar o plano', kind: 'plano', planoId: det.id };
        }
      }
    }

    return { opcoes, sel, temPlanos: true, nivel, xp, proximaLive, planos: planosSel, percentualJornada, atual, proximoPasso };
  }

  private proximaLive(contaId: string, sel: string) {
    return this.prisma.eventoAoVivo.findFirst({
      where: {
        contaId,
        inicioEm: { gte: new Date() },
        ...(sel && sel !== 'geral' ? { OR: [{ trilhaId: null }, { trilhaId: sel }] } : {}),
      },
      orderBy: { inicioEm: 'asc' },
      select: { titulo: true, inicioEm: true, linkAcesso: true },
    });
  }
}
