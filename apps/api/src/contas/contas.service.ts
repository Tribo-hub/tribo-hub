import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { env } from '@tribohub/config';
import { Role, TipoCobranca, TipoConta } from '@tribohub/db';
import { randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContaDto, UpdateAssinaturaDto, UpdateContaDto } from './dto/create-conta.dto';

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);
}

@Injectable()
export class ContasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  private async slugUnico(base: string): Promise<string> {
    const raiz = slugify(base) || 'conta';
    let slug = raiz;
    let n = 1;
    while (await this.prisma.conta.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${raiz}-${n}`;
    }
    return slug;
  }

  async criar(dto: CreateContaDto) {
    const emailNorm = dto.adminEmail.trim().toLowerCase();
    const slug = await this.slugUnico(dto.nome);

    // senha temporária (fallback exibido na tela) + token de convite (define a própria senha por e-mail)
    const senhaTemporaria = randomBytes(6).toString('base64url');
    const senhaHash = await AuthService.hashSenha(senhaTemporaria);
    const conviteToken = randomBytes(32).toString('hex');

    const ehInfo = dto.tipoConta === TipoConta.infoprodutor;

    const conta = await this.prisma.$transaction(async (tx) => {
      const c = await tx.conta.create({
        data: {
          nome: dto.nome,
          tipoConta: dto.tipoConta,
          cnpj: dto.cnpj,
          slug,
          subdominio: slug,
        },
      });

      await tx.usuario.create({
        data: {
          contaId: c.id,
          nome: dto.adminNome,
          email: emailNorm,
          senhaHash,
          role: Role.admin_tenant,
        },
      });

      await tx.inviteToken.create({
        data: {
          email: emailNorm,
          contaId: c.id,
          role: Role.admin_tenant,
          token: conviteToken,
          expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        },
      });

      await tx.assinaturaPlataforma.create({
        data: {
          contaId: c.id,
          plano: dto.plano ?? (ehInfo ? 'base' : 'start'),
          tipoCobranca: ehInfo ? TipoCobranca.alunos_ativos : TipoCobranca.assentos,
          valorBase: ehInfo ? 297 : 0,
          limiteUsuarios: ehInfo ? null : (dto.limiteUsuarios ?? 50),
          alunosIncluidos: ehInfo ? 1000 : null,
          valorPorExcedente: ehInfo ? 0.9 : null,
        },
      });

      return c;
    });

    // envia o convite por e-mail (define a própria senha); senha temporária fica como fallback
    let conviteEnviado = false;
    try {
      await this.email.convite(emailNorm, dto.adminNome, dto.nome, conviteToken);
      conviteEnviado = true;
    } catch {
      // falha de e-mail não impede a criação da conta
    }

    return {
      conta,
      admin: { email: emailNorm, senhaTemporaria },
      conviteEnviado,
    };
  }

  async listar(params: { page?: number; tipoConta?: TipoConta; ativo?: boolean }) {
    const page = Math.max(1, params.page ?? 1);
    const take = 20;
    const where = {
      ...(params.tipoConta ? { tipoConta: params.tipoConta } : {}),
      ...(params.ativo !== undefined ? { ativo: params.ativo } : {}),
    };
    const [total, itens] = await this.prisma.$transaction([
      this.prisma.conta.count({ where }),
      this.prisma.conta.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { assinatura: true, _count: { select: { usuarios: true } } },
      }),
    ]);
    return { total, page, take, itens };
  }

  async obter(id: string) {
    const conta = await this.prisma.conta.findUnique({
      where: { id },
      include: { assinatura: true, _count: { select: { usuarios: true } } },
    });
    if (!conta) throw new NotFoundException('Conta não encontrada');
    return conta;
  }

  // Subdomínios reservados para funções da plataforma — nunca podem ser de um cliente.
  private static readonly SUBDOMINIOS_RESERVADOS = new Set([
    'admin', 'app', 'www', 'api', 'docs', 'status', 'mail', 'email', 'assets', 'cdn', 'ssl',
  ]);

  async atualizar(id: string, dto: UpdateContaDto) {
    await this.obter(id);

    // O subdomínio é o "código" público da conta: mantemos slug === subdominio
    // (o TenantMiddleware resolve o tenant pelo rótulo do subdomínio e busca por slug).
    const data: Record<string, unknown> = { ...dto };
    if (dto.subdominio !== undefined) {
      const sub = dto.subdominio.trim().toLowerCase();
      if (ContasService.SUBDOMINIOS_RESERVADOS.has(sub)) {
        throw new ConflictException(`"${sub}" é um subdomínio reservado da plataforma.`);
      }
      const emUso = await this.prisma.conta.findFirst({
        where: { OR: [{ subdominio: sub }, { slug: sub }], NOT: { id } },
        select: { id: true },
      });
      if (emUso) throw new ConflictException(`O subdomínio "${sub}" já está em uso.`);
      data.subdominio = sub;
      data.slug = sub;
    }

    // Domínio próprio (ex.: area.cliente.com). Vazio limpa; senão valida unicidade.
    if (dto.dominioProprio !== undefined) {
      const dom = dto.dominioProprio.trim().toLowerCase();
      if (!dom) {
        data.dominioProprio = null;
      } else {
        if (dom.endsWith(`.${env.APP_BASE_DOMAIN}`) || dom === env.APP_BASE_DOMAIN) {
          throw new ConflictException('Para endereços em tribohub.com.br, use o campo de subdomínio.');
        }
        const emUso = await this.prisma.conta.findFirst({
          where: { dominioProprio: dom, NOT: { id } },
          select: { id: true },
        });
        if (emUso) throw new ConflictException(`O domínio "${dom}" já está vinculado a outra conta.`);
        data.dominioProprio = dom;
      }
    }

    return this.prisma.conta.update({ where: { id }, data });
  }

  // Métricas agregadas de uma conta (Super Admin).
  async metricas(id: string) {
    const conta = await this.obter(id);
    const ultimaFatura = await this.prisma.faturaPlataforma.findFirst({
      where: { contaId: id },
      orderBy: { competencia: 'desc' },
      select: { competencia: true, valorTotal: true, status: true },
    });

    if (conta.tipoConta === TipoConta.infoprodutor) {
      const [matriculas, ativas, certificados] = await Promise.all([
        this.prisma.matricula.count({ where: { contaId: id } }),
        this.prisma.matricula.count({
          where: { contaId: id, status: 'ativa', OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }] },
        }),
        this.prisma.certificado.count({ where: { contaId: id } }),
      ]);
      return { tipo: 'infoprodutor', matriculas, matriculasAtivas: ativas, certificados, ultimaFatura };
    }

    const [colaboradores, ativos, certificados] = await Promise.all([
      this.prisma.usuario.count({ where: { contaId: id, role: Role.aluno } }),
      this.prisma.usuario.count({ where: { contaId: id, role: Role.aluno, ativo: true } }),
      this.prisma.certificado.count({ where: { contaId: id } }),
    ]);
    return { tipo: 'corporativo', colaboradores, colaboradoresAtivos: ativos, certificados, ultimaFatura };
  }

  listarUsuarios(contaId: string) {
    return this.prisma.usuario.findMany({
      where: { contaId },
      select: { id: true, nome: true, email: true, role: true, ativo: true, ultimoAcesso: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async atualizarAssinatura(id: string, dto: UpdateAssinaturaDto) {
    await this.obter(id);
    return this.prisma.assinaturaPlataforma.update({
      where: { contaId: id },
      data: {
        plano: dto.plano,
        valorBase: dto.valorBase,
        limiteUsuarios: dto.limiteUsuarios,
        alunosIncluidos: dto.alunosIncluidos,
        valorPorExcedente: dto.valorPorExcedente,
      },
    });
  }

  async definirStatus(id: string, ativo: boolean) {
    await this.obter(id);
    // desativar a conta bloqueia o acesso de todos os usuários do tenant
    return this.prisma.$transaction(async (tx) => {
      const conta = await tx.conta.update({ where: { id }, data: { ativo } });
      await tx.usuario.updateMany({ where: { contaId: id }, data: { ativo } });
      return conta;
    });
  }

  // --- Atalhos do menu lateral do Super Admin (abrem em nova aba) ---

  listarLinksMenu() {
    return this.prisma.linkMenuAdmin.findMany({
      orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async criarLinkMenu(nome: string, url: string) {
    const limpo = url.trim();
    const urlFinal = /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`;
    const maxOrdem = await this.prisma.linkMenuAdmin.aggregate({ _max: { ordem: true } });
    return this.prisma.linkMenuAdmin.create({
      data: { nome: nome.trim(), url: urlFinal, ordem: (maxOrdem._max.ordem ?? 0) + 1 },
    });
  }

  async removerLinkMenu(id: string) {
    await this.prisma.linkMenuAdmin.delete({ where: { id } });
    return { ok: true };
  }
}
