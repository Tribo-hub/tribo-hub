import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanoItemTipo, ProprietarioConteudo, StatusMatricula, TipoConta } from '@tribohub/db';
import { env } from '@tribohub/config';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GamificacaoService } from '../gamificacao/gamificacao.service';
import { ProgressoDto } from './dto/progresso.dto';

const PERCENT_CONCLUSAO = 80;

@Injectable()
export class AlunoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gamificacao: GamificacaoService,
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
      orderBy: [{ ordem: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
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
          capaUrl: await this.assinarSeArquivo(t.capaUrl),
          totalAulas: total,
          aulasConcluidas: concluidas,
          percentual: total ? Math.round((concluidas / total) * 100) : 0,
        };
      }),
    );
  }

  // Vitrine: trilhas marcadas como oferta, trancadas, exibidas para alunos de
  // determinadas trilhas (ou todos). Só faz sentido no modo infoprodutor.
  async listarVitrine(user: AuthUser) {
    const conta = await this.prisma.conta.findUnique({ where: { id: user.contaId! } });
    if (!conta || !conta.ativo || conta.tipoConta !== TipoConta.infoprodutor) return [];

    // trilhas que o aluno já acessa (matrícula ativa) — não devem aparecer como oferta
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

    const candidatas = await this.prisma.trilha.findMany({
      where: {
        publicado: true,
        deletedAt: null,
        proprietarioTipo: ProprietarioConteudo.tenant,
        contaId: user.contaId!,
        exibirComoOferta: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const ofertas = candidatas.filter((t) => {
      if (minhas.has(t.id)) return false; // já tem acesso
      if (t.ofertaTodosAlunos) return true;
      const alvos = Array.isArray(t.ofertaParaTrilhas) ? (t.ofertaParaTrilhas as string[]) : [];
      return alvos.some((id) => minhas.has(id));
    });

    return Promise.all(
      ofertas.map(async (t) => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        capaUrl: await this.assinarSeArquivo(t.capaUrl),
        checkoutUrl: t.checkoutUrl,
        whatsappUrl: t.whatsappUrl,
        bloqueada: true,
      })),
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
    const avaliacoes = new Map(progresso.map((p) => [p.aulaId, p.avaliacao]));

    // baseline do drip content: turma do aluno (se a trilha usa turmas) > data fixa > data da matrícula.
    let inicio: Date | null = null;
    if (trilha.usaTurmas) {
      const mat = await this.prisma.matricula.findFirst({
        where: { usuarioId: user.sub, trilhaId: id },
        select: { createdAt: true, turma: { select: { inicioEm: true } } },
      });
      inicio = mat?.turma?.inicioEm ?? mat?.createdAt ?? null;
    } else if (trilha.dripBase === 'fixa' && trilha.dripInicioEm) {
      inicio = trilha.dripInicioEm;
    } else {
      const matricula = await this.prisma.matricula.findFirst({
        where: { usuarioId: user.sub, trilhaId: id },
        select: { createdAt: true },
      });
      inicio = matricula?.createdAt ?? null;
    }
    if (!inicio) {
      const u = await this.prisma.usuario.findUnique({ where: { id: user.sub }, select: { createdAt: true } });
      inicio = u?.createdAt ?? new Date();
    }
    const diasDeAcesso = (Date.now() - inicio.getTime()) / 86_400_000;

    const modulosOut = await Promise.all(
      modulos.map(async (m) => ({
        id: m.id,
        titulo: m.titulo,
        ordem: m.ordem,
        aulas: await Promise.all(
          m.aulas.map(async (a) => {
            const bloqueadaDrip = (a.liberaAposDias ?? 0) > diasDeAcesso;
            const videoUrl =
              bloqueadaDrip || !a.videoUrl
                ? null
                : a.tipoVideo === 'upload'
                  ? (await this.storage.urlDeDownload(a.videoUrl)).url
                  : a.videoUrl;
            return {
              id: a.id,
              titulo: a.titulo,
              tipoVideo: a.tipoVideo,
              duracaoSegundos: a.duracaoSegundos,
              ordem: a.ordem,
              concluida: concluidas.has(a.id),
              avaliacao: avaliacoes.get(a.id) ?? null,
              liberaAposDias: a.liberaAposDias,
              bloqueadaDrip,
              liberaEm: bloqueadaDrip
                ? new Date(inicio!.getTime() + (a.liberaAposDias ?? 0) * 86_400_000)
                : null,
              videoUrl,
              conteudoTexto: bloqueadaDrip ? null : a.conteudoTexto,
              materialUrl: bloqueadaDrip ? null : await this.assinarSeArquivo(a.materialUrl),
              legendaUrl: bloqueadaDrip ? null : await this.assinarSeArquivo(a.legendaUrl),
              anexos: bloqueadaDrip ? [] : await this.assinarAnexos(a.anexos),
            };
          }),
        ),
      })),
    );

    return { id: trilha.id, titulo: trilha.titulo, descricao: trilha.descricao, modulos: modulosOut };
  }

  // Anexos (materiais complementares): [{nome, path}] -> [{nome, url}] com URL assinada.
  private async assinarAnexos(raw: unknown): Promise<{ nome: string; url: string }[]> {
    if (!Array.isArray(raw)) return [];
    const out: { nome: string; url: string }[] = [];
    for (const it of raw) {
      if (it && typeof it === 'object' && 'path' in it) {
        const anexo = it as { nome?: string; path?: string };
        if (!anexo.path) continue;
        const url = await this.assinarSeArquivo(anexo.path);
        if (url) out.push({ nome: anexo.nome ?? 'arquivo', url });
      }
    }
    return out;
  }

  // Material/legenda: se for caminho do Storage, devolve URL assinada; se já for URL, mantém.
  private async assinarSeArquivo(url: string | null): Promise<string | null> {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    try {
      return (await this.storage.urlDeDownload(url)).url;
    } catch {
      return null;
    }
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

    // Desmarcar é explícito (concluido === false); senão, marca por flag ou por % assistido.
    const desmarcando = dto.concluido === false;
    const concluido =
      !desmarcando && (dto.concluido === true || (dto.percentualAssistido ?? 0) >= PERCENT_CONCLUSAO);

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
        concluido,
        concluidoEm: concluido ? new Date() : null,
      },
    });

    // Tarefas de Plano de Ação do tipo "assistir" vinculadas a esta aula (para pontuar/despontuar junto).
    const mats = await this.prisma.matricula.findMany({
      where: { usuarioId: user.sub, contaId: user.contaId!, status: StatusMatricula.ativa },
      select: { trilhaId: true },
    });
    const minhas = mats.map((m) => m.trilhaId);
    const itensAssistir = await this.prisma.planoItem.findMany({
      where: {
        aulaId: dto.aulaId,
        tipo: PlanoItemTipo.assistir,
        plano: { contaId: user.contaId!, OR: [{ trilhaId: null }, { trilhaId: { in: minhas } }] },
      },
      select: { id: true },
    });

    if (concluido) {
      await this.gamificacao.registrar(user, 'aula', dto.aulaId);
      for (const it of itensAssistir) await this.gamificacao.registrar(user, 'plano_item', it.id);
    } else if (desmarcando) {
      // Ao desmarcar, remove o XP da aula e das tarefas "assistir" vinculadas.
      await this.prisma.xpEvento.deleteMany({ where: { usuarioId: user.sub, tipo: 'aula', refId: dto.aulaId } });
      if (itensAssistir.length) {
        await this.prisma.xpEvento.deleteMany({
          where: { usuarioId: user.sub, tipo: 'plano_item', refId: { in: itensAssistir.map((i) => i.id) } },
        });
      }
    }

    const certificado = concluido ? await this.verificarConclusaoTrilha(user, aula.modulo.trilhaId) : null;
    return { ok: true, concluido, certificadoEmitido: !!certificado };
  }

  // Avaliação da aula (estrelas 1-5).
  async avaliarAula(user: AuthUser, aulaId: string, nota: number) {
    const aula = await this.prisma.aula.findFirst({
      where: { id: aulaId, deletedAt: null },
      include: { modulo: true },
    });
    if (!aula) throw new NotFoundException('Aula não encontrada');
    await this.trilhaAcessivel(user, aula.modulo.trilhaId);

    await this.prisma.progresso.upsert({
      where: { usuarioId_aulaId: { usuarioId: user.sub, aulaId } },
      create: { usuarioId: user.sub, aulaId, contaId: user.contaId!, avaliacao: nota },
      update: { avaliacao: nota },
    });
    await this.gamificacao.registrar(user, 'avaliacao', aulaId);
    return { ok: true, avaliacao: nota };
  }

  // Quiz da aula (perguntas + respostas do próprio aluno).
  private async aulaAcessivelAluno(user: AuthUser, aulaId: string) {
    const aula = await this.prisma.aula.findFirst({
      where: { id: aulaId, deletedAt: null },
      include: { modulo: true },
    });
    if (!aula) throw new NotFoundException('Aula não encontrada');
    await this.trilhaAcessivel(user, aula.modulo.trilhaId);
    return aula;
  }

  async obterQuiz(user: AuthUser, aulaId: string) {
    await this.aulaAcessivelAluno(user, aulaId);
    const perguntas = await this.prisma.quizPergunta.findMany({
      where: { aulaId },
      orderBy: { ordem: 'asc' },
    });
    const minhas = await this.prisma.quizResposta.findMany({
      where: { usuarioId: user.sub, perguntaId: { in: perguntas.map((p) => p.id) } },
    });
    const map = new Map(minhas.map((r) => [r.perguntaId, r.resposta]));
    return perguntas.map((p) => ({ id: p.id, pergunta: p.pergunta, minhaResposta: map.get(p.id) ?? null }));
  }

  async responderQuiz(user: AuthUser, aulaId: string, respostas: { perguntaId: string; resposta: string }[]) {
    await this.aulaAcessivelAluno(user, aulaId);
    const validas = new Set(
      (await this.prisma.quizPergunta.findMany({ where: { aulaId }, select: { id: true } })).map((p) => p.id),
    );
    for (const r of respostas) {
      if (!validas.has(r.perguntaId) || !r.resposta?.trim()) continue;
      await this.prisma.quizResposta.upsert({
        where: { perguntaId_usuarioId: { perguntaId: r.perguntaId, usuarioId: user.sub } },
        create: { perguntaId: r.perguntaId, usuarioId: user.sub, contaId: user.contaId!, resposta: r.resposta },
        update: { resposta: r.resposta },
      });
    }
    await this.gamificacao.registrar(user, 'quiz', aulaId);
    return { ok: true };
  }

  // Comentários por aula (engajamento). Escopados pela conta do aluno; thread de 1 nível.
  private async contaPermiteComentarios(contaId?: string | null) {
    if (!contaId) return true;
    const conta = await this.prisma.conta.findUnique({
      where: { id: contaId },
      select: { permiteComentarios: true },
    });
    return conta?.permiteComentarios ?? true;
  }

  private async montarThreadComentarios(
    comentarios: { id: string; usuarioId: string; texto: string; respostaAId: string | null; createdAt: Date }[],
    meuId: string,
  ) {
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
      meu: c.usuarioId === meuId,
      data: c.createdAt,
    });
    return comentarios
      .filter((c) => !c.respostaAId)
      .map((c) => ({ ...fmt(c), respostas: comentarios.filter((r) => r.respostaAId === c.id).map(fmt) }));
  }

  async listarComentarios(user: AuthUser, aulaId: string) {
    await this.aulaAcessivelAluno(user, aulaId);
    const habilitado = await this.contaPermiteComentarios(user.contaId);
    const comentarios = await this.prisma.comentarioAula.findMany({
      where: { aulaId, contaId: user.contaId!, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return { habilitado, comentarios: await this.montarThreadComentarios(comentarios, user.sub) };
  }

  async comentar(user: AuthUser, aulaId: string, texto: string, respostaAId?: string) {
    await this.aulaAcessivelAluno(user, aulaId);
    if (!(await this.contaPermiteComentarios(user.contaId)))
      throw new ForbiddenException('Comentários desativados nesta conta');
    if (!texto?.trim()) throw new BadRequestException('Comentário vazio');
    if (respostaAId) {
      const pai = await this.prisma.comentarioAula.findFirst({
        where: { id: respostaAId, aulaId, contaId: user.contaId!, deletedAt: null },
      });
      if (!pai) throw new NotFoundException('Comentário não encontrado');
    }
    const c = await this.prisma.comentarioAula.create({
      data: {
        aulaId,
        usuarioId: user.sub,
        contaId: user.contaId!,
        texto: texto.trim(),
        respostaAId: respostaAId ?? null,
      },
    });
    // XP de comentário: 1x por aula (refId = aulaId) para evitar farm com vários comentários.
    await this.gamificacao.registrar(user, 'comentario', aulaId);
    return { ok: true, id: c.id };
  }

  async removerComentario(user: AuthUser, comentarioId: string) {
    const c = await this.prisma.comentarioAula.findFirst({
      where: { id: comentarioId, contaId: user.contaId!, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Comentário não encontrado');
    if (c.usuarioId !== user.sub) throw new ForbiddenException('Sem permissão');
    await this.prisma.comentarioAula.update({ where: { id: comentarioId }, data: { deletedAt: new Date() } });
    return { ok: true };
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

    const cert = await this.prisma.certificado.create({
      data: {
        usuarioId: user.sub,
        trilhaId,
        contaId: user.contaId!,
        codigoVerificacao: randomUUID(),
      },
    });
    // notificação de conquista (sino)
    const trilha = await this.prisma.trilha.findUnique({ where: { id: trilhaId }, select: { titulo: true } });
    await this.prisma.notificacao
      .create({
        data: {
          usuarioId: user.sub,
          contaId: user.contaId,
          titulo: 'Certificado disponível 🎉',
          mensagem: `Você concluiu "${trilha?.titulo ?? 'a trilha'}" e seu certificado está pronto.`,
          tipo: 'certificado',
        },
      })
      .catch(() => undefined);
    await this.gamificacao.registrar(user, 'trilha', trilhaId);
    return cert;
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
        conta: { select: { nome: true, logoUrl: true } },
      },
    });
    if (!cert || cert.usuarioId !== user.sub) throw new NotFoundException('Certificado não encontrado');

    let path = cert.pdfUrl;
    if (!path) {
      const logo = await this.carregarLogo(cert.conta.logoUrl);
      const buffer = await this.gerarPdf({
        aluno: cert.usuario.nome,
        trilha: cert.trilha.titulo,
        emissor: cert.conta.nome,
        codigo: cert.codigoVerificacao,
        data: cert.emitidoEm,
        logo,
      });
      path = `${cert.contaId}/certificados/${cert.codigoVerificacao}.pdf`;
      await this.storage.uploadBuffer(path, buffer, 'application/pdf');
      await this.prisma.certificado.update({ where: { id: certId }, data: { pdfUrl: path } });
    }
    return this.storage.urlDeDownload(path);
  }

  // Baixa os bytes do logo da conta (caminho do Storage ou URL externa) para embutir no PDF.
  private async carregarLogo(logoUrl: string | null): Promise<Buffer | null> {
    if (!logoUrl) return null;
    try {
      const url = logoUrl.startsWith('http') ? logoUrl : (await this.storage.urlDeDownload(logoUrl)).url;
      const r = await fetch(url);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch {
      return null;
    }
  }

  private gerarPdf(d: {
    aluno: string;
    trilha: string;
    emissor: string;
    codigo: string;
    data: Date;
    logo?: Buffer | null;
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
      if (d.logo) {
        try {
          doc.image(d.logo, (w - 120) / 2, 40, { fit: [120, 60], align: 'center' });
          doc.y = 110;
        } catch {
          /* logo inválido — segue sem ele */
        }
      }
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
