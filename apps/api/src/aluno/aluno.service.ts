import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProprietarioConteudo, StatusMatricula, TipoConta } from '@tribohub/db';
import { env } from '@tribohub/config';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
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
    // infoprodutor: acesso somente às trilhas com matrícula ATIVA e não vencida
    const mats = await this.prisma.matricula.findMany({
      where: {
        usuarioId: user.sub,
        contaId: user.contaId!,
        status: StatusMatricula.ativa,
        OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }],
      },
      select: { trilhaId: true },
    });
    return {
      publicado: true,
      deletedAt: null,
      proprietarioTipo: ProprietarioConteudo.tenant,
      contaId: user.contaId,
      id: { in: mats.map((m) => m.trilhaId) },
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

  async baixarCertificado(user: AuthUser, certId: string) {
    const cert = await this.prisma.certificado.findUnique({
      where: { id: certId },
      include: {
        usuario: { select: { nome: true } },
        trilha: { select: { titulo: true } },
        conta: { select: { nome: true } },
      },
    });
    if (!cert || cert.usuarioId !== user.sub) throw new NotFoundException('Certificado não encontrado');

    let path = cert.pdfUrl;
    if (!path) {
      const buffer = await this.gerarPdf({
        aluno: cert.usuario.nome,
        trilha: cert.trilha.titulo,
        emissor: cert.conta.nome,
        codigo: cert.codigoVerificacao,
        data: cert.emitidoEm,
      });
      path = `${cert.contaId}/certificados/${cert.codigoVerificacao}.pdf`;
      await this.storage.uploadBuffer(path, buffer, 'application/pdf');
      await this.prisma.certificado.update({ where: { id: certId }, data: { pdfUrl: path } });
    }
    return this.storage.urlDeDownload(path);
  }

  private gerarPdf(d: {
    aluno: string;
    trilha: string;
    emissor: string;
    codigo: string;
    data: Date;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const w = doc.page.width;
      const hgt = doc.page.height;
      doc.lineWidth(3).strokeColor('#7c3aed').rect(20, 20, w - 40, hgt - 40).stroke();
      doc.moveDown(2);
      doc.fontSize(34).fillColor('#1e293b').text('CERTIFICADO', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(14).fillColor('#64748b').text('de conclusão', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(16).fillColor('#334155').text('Certificamos que', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(26).fillColor('#7c3aed').text(d.aluno, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).fillColor('#334155').text('concluiu a trilha', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(20).fillColor('#1e293b').text(d.trilha, { align: 'center' });
      doc.moveDown(2);
      doc
        .fontSize(12)
        .fillColor('#64748b')
        .text(`Emitido por ${d.emissor} em ${d.data.toLocaleDateString('pt-BR')}`, { align: 'center' });
      doc.moveDown(0.4);
      doc
        .fontSize(10)
        .fillColor('#94a3b8')
        .text(`Verificação: ${env.APP_URL}/verificar/${d.codigo}`, { align: 'center' });
      doc.end();
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
