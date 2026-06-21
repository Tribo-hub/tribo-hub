import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProprietarioConteudo, TipoConta } from '@tribohub/db';
import { randomUUID } from 'crypto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ProgressoDto } from './dto/progresso.dto';

const PERCENT_CONCLUSAO = 80;

@Injectable()
export class AlunoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Filtro de trilhas acessíveis pelo aluno, conforme o tipo da conta.
  private async filtroAcesso(user: AuthUser) {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    if (!conta || !conta.ativo) throw new ForbiddenException('Conta inválida');
    if (conta.tipoConta === TipoConta.corporativo) {
      // corporativo consome o catálogo da plataforma
      return { publicado: true, deletedAt: null, proprietarioTipo: ProprietarioConteudo.plataforma };
    }
    // infoprodutor consome o conteúdo da própria conta
    return {
      publicado: true,
      deletedAt: null,
      proprietarioTipo: ProprietarioConteudo.tenant,
      contaId: user.contaId,
    };
  }

  async listarTrilhas(user: AuthUser) {
    const where = await this.filtroAcesso(user);
    const trilhas = await this.prisma.trilha.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { modulos: true } } },
    });

    // progresso por trilha
    return Promise.all(
      trilhas.map(async (t) => {
        const { total, concluidas } = await this.progressoTrilha(user.sub, t.id);
        return {
          id: t.id,
          titulo: t.titulo,
          descricao: t.descricao,
          capaUrl: t.capaUrl,
          totalAulas: total,
          aulasConcluidas: concluidas,
          percentual: total ? Math.round((concluidas / total) * 100) : 0,
        };
      }),
    );
  }

  private async trilhaAcessivel(user: AuthUser, trilhaId: string) {
    const where = await this.filtroAcesso(user);
    const trilha = await this.prisma.trilha.findFirst({ where: { ...where, id: trilhaId } });
    if (!trilha) throw new NotFoundException('Trilha não disponível');
    return trilha;
  }

  async obterTrilha(user: AuthUser, id: string) {
    const trilha = await this.trilhaAcessivel(user, id);
    const modulos = await this.prisma.modulo.findMany({
      where: { trilhaId: id, deletedAt: null },
      orderBy: { ordem: 'asc' },
      include: { aulas: { where: { deletedAt: null }, orderBy: { ordem: 'asc' } } },
    });

    const progresso = await this.prisma.progresso.findMany({
      where: { usuarioId: user.sub, aula: { modulo: { trilhaId: id } } },
    });
    const concluidas = new Set(progresso.filter((p) => p.concluido).map((p) => p.aulaId));

    const modulosOut = await Promise.all(
      modulos.map(async (m) => ({
        id: m.id,
        titulo: m.titulo,
        ordem: m.ordem,
        aulas: await Promise.all(
          m.aulas.map(async (a) => ({
            id: a.id,
            titulo: a.titulo,
            tipoVideo: a.tipoVideo,
            duracaoSegundos: a.duracaoSegundos,
            ordem: a.ordem,
            concluida: concluidas.has(a.id),
            // upload -> URL assinada temporária; youtube/vimeo -> URL direta
            videoUrl:
              a.tipoVideo === 'upload'
                ? (await this.storage.urlDeDownload(a.videoUrl)).url
                : a.videoUrl,
          })),
        ),
      })),
    );

    return { id: trilha.id, titulo: trilha.titulo, descricao: trilha.descricao, modulos: modulosOut };
  }

  async proximaAula(user: AuthUser, trilhaId: string) {
    await this.trilhaAcessivel(user, trilhaId);
    const aulas = await this.prisma.aula.findMany({
      where: { modulo: { trilhaId, deletedAt: null }, deletedAt: null },
      orderBy: [{ modulo: { ordem: 'asc' } }, { ordem: 'asc' }],
    });
    const concluidas = await this.prisma.progresso.findMany({
      where: { usuarioId: user.sub, concluido: true, aulaId: { in: aulas.map((a) => a.id) } },
      select: { aulaId: true },
    });
    const setC = new Set(concluidas.map((c) => c.aulaId));
    const proxima = aulas.find((a) => !setC.has(a.id));
    return proxima ? { id: proxima.id, titulo: proxima.titulo } : null;
  }

  async registrarProgresso(user: AuthUser, dto: ProgressoDto) {
    const aula = await this.prisma.aula.findFirst({
      where: { id: dto.aulaId, deletedAt: null },
      include: { modulo: true },
    });
    if (!aula) throw new NotFoundException('Aula não encontrada');
    // valida acesso à trilha da aula
    await this.trilhaAcessivel(user, aula.modulo.trilhaId);

    const concluido =
      dto.concluido === true || (dto.percentualAssistido ?? 0) >= PERCENT_CONCLUSAO;

    await this.prisma.progresso.upsert({
      where: { usuarioId_aulaId: { usuarioId: user.sub, aulaId: dto.aulaId } },
      create: {
        usuarioId: user.sub,
        aulaId: dto.aulaId,
        contaId: user.contaId!,
        percentualAssistido: dto.percentualAssistido,
        concluido,
        concluidoEm: concluido ? new Date() : null,
      },
      update: {
        percentualAssistido: dto.percentualAssistido,
        concluido: concluido ? true : undefined,
        concluidoEm: concluido ? new Date() : undefined,
      },
    });

    const certificado = await this.verificarConclusaoTrilha(user, aula.modulo.trilhaId);
    return { ok: true, concluido, certificadoEmitido: !!certificado };
  }

  private async progressoTrilha(usuarioId: string, trilhaId: string) {
    const aulas = await this.prisma.aula.findMany({
      where: { modulo: { trilhaId, deletedAt: null }, deletedAt: null },
      select: { id: true },
    });
    const ids = aulas.map((a) => a.id);
    const concluidas = ids.length
      ? await this.prisma.progresso.count({
          where: { usuarioId, concluido: true, aulaId: { in: ids } },
        })
      : 0;
    return { total: ids.length, concluidas };
  }

  private async verificarConclusaoTrilha(user: AuthUser, trilhaId: string) {
    const { total, concluidas } = await this.progressoTrilha(user.sub, trilhaId);
    if (total === 0 || concluidas < total) return null;

    const existe = await this.prisma.certificado.findUnique({
      where: { usuarioId_trilhaId: { usuarioId: user.sub, trilhaId } },
    });
    if (existe) return existe;

    return this.prisma.certificado.create({
      data: {
        usuarioId: user.sub,
        trilhaId,
        contaId: user.contaId!,
        codigoVerificacao: randomUUID(),
      },
    });
  }

  meusProgressos(user: AuthUser) {
    return this.prisma.progresso.findMany({
      where: { usuarioId: user.sub },
      select: { aulaId: true, concluido: true, percentualAssistido: true, concluidoEm: true },
    });
  }

  meusCertificados(user: AuthUser) {
    return this.prisma.certificado.findMany({
      where: { usuarioId: user.sub },
      include: { trilha: { select: { titulo: true } } },
      orderBy: { emitidoEm: 'desc' },
    });
  }

  async verificar(codigo: string) {
    const cert = await this.prisma.certificado.findUnique({
      where: { codigoVerificacao: codigo },
      include: {
        usuario: { select: { nome: true } },
        trilha: { select: { titulo: true } },
        conta: { select: { nome: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificado não encontrado');
    return {
      valido: true,
      aluno: cert.usuario.nome,
      trilha: cert.trilha.titulo,
      emissor: cert.conta.nome,
      emitidoEm: cert.emitidoEm,
      codigo: cert.codigoVerificacao,
    };
  }
}
