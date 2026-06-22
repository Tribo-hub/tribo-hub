import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, TipoCobranca, TipoConta } from '@tribohub/db';
import { randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

    // senha temporária do admin (em produção: enviar via convite por e-mail)
    const senhaTemporaria = randomBytes(6).toString('base64url');
    const senhaHash = await AuthService.hashSenha(senhaTemporaria);

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

    return {
      conta,
      admin: { email: emailNorm, senhaTemporaria }, // DEV: enviar por convite (Resend) na sequência
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

  async atualizar(id: string, dto: UpdateContaDto) {
    await this.obter(id);
    return this.prisma.conta.update({ where: { id }, data: dto });
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
}
