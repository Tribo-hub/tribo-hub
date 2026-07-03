import { Injectable, NotFoundException } from '@nestjs/common';
import { StatusMatricula } from '@tribohub/db';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export type TipoXp = 'aula' | 'trilha' | 'plano_item' | 'quiz' | 'avaliacao' | 'comentario';

// Config padrão (usada quando trilha/conta ainda não personalizaram).
const PADRAO = {
  xpAula: 10,
  xpTrilha: 100,
  xpPlanoItem: 5,
  xpQuiz: 0,
  xpAvaliacao: 0,
  xpComentario: 0,
  xpPorNivel: 200,
  badgeAulas1: 1,
  badgeAulas2: 10,
  badgeAulas3: 50,
  badgeCert1: 1,
  badgeCert2: 3,
  badgeNivel: 5,
};
type Config = typeof PADRAO;

const XP_FIELD: Record<TipoXp, keyof Config> = {
  aula: 'xpAula',
  trilha: 'xpTrilha',
  plano_item: 'xpPlanoItem',
  quiz: 'xpQuiz',
  avaliacao: 'xpAvaliacao',
  comentario: 'xpComentario',
};

@Injectable()
export class GamificacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Config efetiva: override da trilha -> config da conta -> padrão.
  private async getConfig(contaId: string, trilhaId?: string | null): Promise<Config> {
    if (trilhaId) {
      const t = await this.prisma.configGamificacaoTrilha.findUnique({ where: { trilhaId } });
      if (t) return { ...PADRAO, ...t };
    }
    const c = await this.prisma.configGamificacao.findUnique({ where: { contaId } });
    return { ...PADRAO, ...(c ?? {}) };
  }

  // Descobre a trilha a que a ação pertence (p/ pontuar e somar por trilha).
  private async resolverTrilha(tipo: TipoXp, refId: string): Promise<string | null> {
    if (tipo === 'trilha') return refId;
    if (tipo === 'plano_item') {
      const it = await this.prisma.planoItem.findUnique({ where: { id: refId }, select: { plano: { select: { trilhaId: true } } } });
      return it?.plano.trilhaId ?? null;
    }
    // aula | quiz | avaliacao | comentario -> refId é a aula
    const a = await this.prisma.aula.findUnique({ where: { id: refId }, select: { modulo: { select: { trilhaId: true } } } });
    return a?.modulo.trilhaId ?? null;
  }

  // Premiação idempotente: não pontua a mesma (usuario,tipo,refId) duas vezes.
  // O XP vem da config da TRILHA (ou da conta como fallback); ação com XP 0 é ignorada.
  async registrar(user: AuthUser, tipo: TipoXp, refId: string) {
    if (!user.contaId) return;
    const trilhaId = await this.resolverTrilha(tipo, refId);
    const config = await this.getConfig(user.contaId, trilhaId);
    const xp = config[XP_FIELD[tipo]];
    if (!xp || xp <= 0) return;
    try {
      await this.prisma.xpEvento.create({
        data: { usuarioId: user.sub, contaId: user.contaId, trilhaId, tipo, refId, xp },
      });
    } catch {
      // já existe (unique) — ignora
    }
  }

  // Premiação com XP EXPLÍCITO (ex.: entrega de plano, com penalidade já aplicada). Idempotente.
  async registrarXp(user: AuthUser, tipo: string, refId: string, xp: number, trilhaId: string | null) {
    if (!user.contaId || !xp || xp <= 0) return;
    try {
      await this.prisma.xpEvento.create({
        data: { usuarioId: user.sub, contaId: user.contaId, trilhaId, tipo, refId, xp: Math.round(xp) },
      });
    } catch {
      // já existe (unique) — ignora
    }
  }

  // ---------- Aluno: visão geral (resumo global + cards por trilha) ----------
  async resumo(user: AuthUser) {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    if (!conta || !conta.gamificacaoAtiva) return { ativo: false };

    // Global (somatório de tudo)
    const totalAgg = await this.prisma.xpEvento.aggregate({ where: { usuarioId: user.sub }, _sum: { xp: true } });
    const xpGlobal = totalAgg._sum.xp ?? 0;
    const contaConfig = await this.getConfig(user.contaId!);
    const porNivelG = contaConfig.xpPorNivel > 0 ? contaConfig.xpPorNivel : 200;

    // Trilhas do aluno (matrículas ativas)
    const mats = await this.prisma.matricula.findMany({
      where: { usuarioId: user.sub, contaId: user.contaId!, status: StatusMatricula.ativa },
      select: { trilha: { select: { id: true, titulo: true, capaUrl: true } } },
    });
    const trilhasUnicas = [...new Map(mats.map((m) => [m.trilha.id, m.trilha])).values()];

    // XP do aluno por trilha
    const porTrilha = await this.prisma.xpEvento.groupBy({
      by: ['trilhaId'],
      where: { usuarioId: user.sub, trilhaId: { not: null } },
      _sum: { xp: true },
    });
    const xpMap = new Map(porTrilha.map((g) => [g.trilhaId as string, g._sum.xp ?? 0]));

    const trilhas = await Promise.all(
      trilhasUnicas.map(async (t) => {
        const xp = xpMap.get(t.id) ?? 0;
        const cfg = await this.getConfig(user.contaId!, t.id);
        const pn = cfg.xpPorNivel > 0 ? cfg.xpPorNivel : 200;
        return {
          trilhaId: t.id,
          titulo: t.titulo,
          capaUrl: await this.assinarSeArquivo(t.capaUrl),
          xp,
          nivel: Math.floor(xp / pn) + 1,
        };
      }),
    );
    trilhas.sort((a, b) => b.xp - a.xp);

    return {
      ativo: true,
      global: {
        xp: xpGlobal,
        nivel: Math.floor(xpGlobal / porNivelG) + 1,
        xpNivelAtual: xpGlobal % porNivelG,
        xpProxNivel: porNivelG,
      },
      trilhas,
    };
  }

  // ---------- Aluno: detalhe de uma trilha (nível, badges e ranking) ----------
  async resumoTrilha(user: AuthUser, trilhaId: string) {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    if (!conta || !conta.gamificacaoAtiva) return { ativo: false };
    const trilha = await this.prisma.trilha.findFirst({ where: { id: trilhaId, contaId: user.contaId! }, select: { id: true, titulo: true } });
    if (!trilha) throw new NotFoundException('Trilha não encontrada');

    const config = await this.getConfig(user.contaId!, trilhaId);
    const porNivel = config.xpPorNivel > 0 ? config.xpPorNivel : 200;

    const xpAgg = await this.prisma.xpEvento.aggregate({ where: { usuarioId: user.sub, trilhaId }, _sum: { xp: true } });
    const xp = xpAgg._sum.xp ?? 0;
    const nivel = Math.floor(xp / porNivel) + 1;

    const [aulas, cert] = await Promise.all([
      this.prisma.progresso.count({ where: { usuarioId: user.sub, concluido: true, aula: { modulo: { trilhaId } } } }),
      this.prisma.certificado.count({ where: { usuarioId: user.sub, trilhaId } }),
    ]);
    const concluida = cert > 0;

    const fmtAulas = (n: number) => `Conclua ${n} ${n === 1 ? 'aula' : 'aulas'} nesta trilha`;
    const badges = [
      { id: 'primeira-aula', nome: 'Primeiros passos', icone: '👣', conquistada: aulas >= config.badgeAulas1, criterio: fmtAulas(config.badgeAulas1), atual: aulas, meta: config.badgeAulas1 },
      { id: 'maratonista', nome: 'Maratonista', icone: '🏃', conquistada: aulas >= config.badgeAulas2, criterio: fmtAulas(config.badgeAulas2), atual: aulas, meta: config.badgeAulas2 },
      { id: 'dedicado', nome: 'Dedicado', icone: '🔥', conquistada: aulas >= config.badgeAulas3, criterio: fmtAulas(config.badgeAulas3), atual: aulas, meta: config.badgeAulas3 },
      { id: 'certificado', nome: 'Trilha concluída', icone: '🎓', conquistada: concluida, criterio: 'Conclua a trilha (certificado)', atual: concluida ? 1 : 0, meta: 1 },
      { id: 'nivel', nome: `Nível ${config.badgeNivel}`, icone: '⭐', conquistada: nivel >= config.badgeNivel, criterio: `Alcance o nível ${config.badgeNivel} nesta trilha`, atual: nivel, meta: config.badgeNivel },
    ];

    // Ranking da trilha (top 10 por XP na trilha)
    const grupos = await this.prisma.xpEvento.groupBy({ by: ['usuarioId'], where: { trilhaId }, _sum: { xp: true } });
    const ordenado = grupos.map((g) => ({ usuarioId: g.usuarioId, xp: g._sum.xp ?? 0 })).sort((a, b) => b.xp - a.xp);
    const top = ordenado.slice(0, 10);
    const nomes = top.length
      ? await this.prisma.usuario.findMany({ where: { id: { in: top.map((t) => t.usuarioId) } }, select: { id: true, nome: true } })
      : [];
    const nomeMap = new Map(nomes.map((n) => [n.id, n.nome]));
    const ranking = top.map((t, i) => ({ posicao: i + 1, nome: nomeMap.get(t.usuarioId) ?? 'Aluno', xp: t.xp, eu: t.usuarioId === user.sub }));
    const minhaPosicao = ordenado.findIndex((t) => t.usuarioId === user.sub) + 1;

    return {
      ativo: true,
      trilhaId: trilha.id,
      titulo: trilha.titulo,
      xp,
      nivel,
      xpNivelAtual: xp % porNivel,
      xpProxNivel: porNivel,
      aulas,
      concluida,
      badges,
      ranking,
      minhaPosicao,
    };
  }

  // ---------- Configuração (produtor) ----------
  async obterConfig(user: AuthUser): Promise<Config> {
    return this.getConfig(user.contaId!);
  }

  async salvarConfig(user: AuthUser, dto: Partial<Config>) {
    const dados = { ...PADRAO, ...dto };
    return this.prisma.configGamificacao.upsert({
      where: { contaId: user.contaId! },
      create: { contaId: user.contaId!, ...dados },
      update: dados,
    });
  }

  // Config de uma trilha. `personalizada` indica se tem regra própria (true) ou herda da conta (false).
  async obterConfigTrilha(user: AuthUser, trilhaId: string): Promise<Config & { personalizada: boolean }> {
    await this.trilhaDaConta(user.contaId!, trilhaId);
    const override = await this.prisma.configGamificacaoTrilha.findUnique({ where: { trilhaId } });
    const config = await this.getConfig(user.contaId!, trilhaId);
    return { ...config, personalizada: !!override };
  }

  async salvarConfigTrilha(user: AuthUser, trilhaId: string, dto: Partial<Config>) {
    await this.trilhaDaConta(user.contaId!, trilhaId);
    const dados = { ...PADRAO, ...dto };
    return this.prisma.configGamificacaoTrilha.upsert({
      where: { trilhaId },
      create: { trilhaId, contaId: user.contaId!, ...dados },
      update: dados,
    });
  }

  // Remove a regra própria da trilha — ela volta a herdar o padrão da conta.
  async resetConfigTrilha(user: AuthUser, trilhaId: string) {
    await this.trilhaDaConta(user.contaId!, trilhaId);
    await this.prisma.configGamificacaoTrilha.deleteMany({ where: { trilhaId } });
    return { ok: true };
  }

  // ---------- Helpers ----------
  private async trilhaDaConta(contaId: string, trilhaId: string) {
    const t = await this.prisma.trilha.findFirst({ where: { id: trilhaId, contaId, deletedAt: null }, select: { id: true } });
    if (!t) throw new NotFoundException('Trilha não encontrada');
    return t;
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
}
