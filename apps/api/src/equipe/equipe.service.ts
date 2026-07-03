import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@tribohub/db';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const LIMITE_FUNCIONARIOS = 10;
const FUNCOES = ['gerente', 'atendente'];

@Injectable()
export class EquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  listar(contaId: string) {
    return this.prisma.usuario.findMany({
      where: { contaId, role: Role.admin_tenant, funcaoEquipe: { in: FUNCOES } },
      select: { id: true, nome: true, email: true, funcaoEquipe: true, ativo: true, ultimoAcesso: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async convidar(contaId: string, dto: { nome: string; email: string; funcao: string }) {
    const funcao = (dto.funcao || '').trim();
    if (!FUNCOES.includes(funcao)) throw new BadRequestException('Função inválida (gerente ou atendente)');
    const nome = (dto.nome || '').trim();
    const emailNorm = (dto.email || '').trim().toLowerCase();
    if (!nome || !emailNorm) throw new BadRequestException('Informe nome e e-mail');

    const total = await this.prisma.usuario.count({
      where: { contaId, role: Role.admin_tenant, funcaoEquipe: { in: FUNCOES } },
    });
    if (total >= LIMITE_FUNCIONARIOS) throw new ForbiddenException(`Limite de ${LIMITE_FUNCIONARIOS} funcionários atingido.`);

    const existente = await this.prisma.usuario.findFirst({ where: { email: emailNorm, contaId } });
    if (existente) throw new BadRequestException('Já existe um usuário com este e-mail nesta conta');

    const conta = await this.prisma.conta.findUnique({ where: { id: contaId }, select: { nome: true } });
    const senhaTemporaria = randomBytes(6).toString('base64url');
    const senhaHash = await bcrypt.hash(senhaTemporaria, 12);
    const token = randomBytes(32).toString('hex');

    await this.prisma.$transaction([
      this.prisma.usuario.create({
        data: { contaId, nome, email: emailNorm, senhaHash, role: Role.admin_tenant, funcaoEquipe: funcao, ativo: false },
      }),
      this.prisma.inviteToken.create({
        data: { email: emailNorm, contaId, role: Role.admin_tenant, token, expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60_000) },
      }),
    ]);

    let conviteEnviado = false;
    try {
      await this.email.convite(emailNorm, nome, conta?.nome ?? 'Tribo Hub', token);
      conviteEnviado = true;
    } catch {
      /* falha de e-mail não impede a criação */
    }
    return { email: emailNorm, funcao, conviteEnviado, senhaTemporaria };
  }

  private async doConta(contaId: string, id: string) {
    const u = await this.prisma.usuario.findFirst({ where: { id, contaId, role: Role.admin_tenant, funcaoEquipe: { in: FUNCOES } } });
    if (!u) throw new NotFoundException('Funcionário não encontrado');
    return u;
  }

  async atualizar(contaId: string, id: string, dto: { funcao?: string; ativo?: boolean }) {
    await this.doConta(contaId, id);
    const data: { funcaoEquipe?: string; ativo?: boolean } = {};
    if (dto.funcao !== undefined) {
      if (!FUNCOES.includes(dto.funcao)) throw new BadRequestException('Função inválida');
      data.funcaoEquipe = dto.funcao;
    }
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    return this.prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nome: true, email: true, funcaoEquipe: true, ativo: true },
    });
  }

  async remover(contaId: string, id: string) {
    await this.doConta(contaId, id);
    // desativa (não apaga) para preservar histórico e evitar quebra de FKs
    await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }
}
