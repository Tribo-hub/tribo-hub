import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoConta } from '@tribohub/db';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class CorporativoService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Colaboradores ----------
  async convidar(contaId: string, nome: string, email: string) {
    const emailNorm = email.trim().toLowerCase();
    const assinatura = await this.prisma.assinaturaPlataforma.findUnique({ where: { contaId } });
    const limite = assinatura?.limiteUsuarios ?? null;
    const ativos = await this.prisma.usuario.count({
      where: { contaId, role: 'aluno', ativo: true },
    });
    if (limite !== null && ativos >= limite) {
      throw new ForbiddenException(`Limite de ${limite} colaboradores ativos atingido`);
    }

    const existente = await this.prisma.usuario.findFirst({ where: { email: emailNorm, contaId } });
    if (existente?.ativo) throw new ConflictException('Colaborador já ativo');

    const usuario =
      existente ??
      (await this.prisma.usuario.create({
        data: {
          contaId,
          nome,
          email: emailNorm,
          senhaHash: await bcrypt.hash(randomBytes(12).toString('base64url'), 12),
          role: 'aluno',
          ativo: false,
        },
      }));

    const token = randomUUID();
    await this.prisma.inviteToken.create({
      data: { email: emailNorm, contaId, role: 'aluno', token, expiraEm: new Date(Date.now() + SETE_DIAS) },
    });

    // TODO(Resend): enviar e-mail com link de ativação. Em dev, devolvemos o token.
    return {
      usuario: { id: usuario.id, nome: usuario.nome, email: emailNorm },
      conviteToken: token,
    };
  }

  async listarColaboradores(contaId: string) {
    const us = await this.prisma.usuario.findMany({
      where: { contaId, role: 'aluno' },
      select: { id: true, nome: true, email: true, ativo: true, ultimoAcesso: true },
      orderBy: { createdAt: 'desc' },
    });
    return us.map((u) => ({ ...u, status: u.ativo ? 'ativo' : 'convite pendente' }));
  }

  async definirStatusColaborador(contaId: string, id: string, ativo: boolean) {
    const u = await this.prisma.usuario.findFirst({ where: { id, contaId, role: 'aluno' } });
    if (!u) throw new NotFoundException('Colaborador não encontrado');
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo },
      select: { id: true, ativo: true },
    });
  }

  // ---------- Dashboard ----------
  async dashboard(user: AuthUser) {
    const contaId = user.contaId!;
    const conta = await this.prisma.conta.findUnique({ where: { id: contaId } });
    if (!conta) throw new NotFoundException('Conta não encontrada');

    if (conta.tipoConta !== TipoConta.corporativo) {
      // resumo p/ infoprodutor
      const [matriculas, ativosRaw, certificados] = await Promise.all([
        this.prisma.matricula.count({ where: { contaId } }),
        this.prisma.matricula.findMany({
          where: { contaId, status: 'ativa', OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }] },
          select: { usuarioId: true },
        }),
        this.prisma.certificado.count({ where: { contaId } }),
      ]);
      return {
        tipo: 'infoprodutor',
        alunosAtivos: new Set(ativosRaw.map((m) => m.usuarioId)).size,
        totalMatriculas: matriculas,
        certificadosEmitidos: certificados,
      };
    }

    const desde = new Date(Date.now() - SETE_DIAS);
    const [total, ativos7d, trilhasConcluidas] = await Promise.all([
      this.prisma.usuario.count({ where: { contaId, role: 'aluno', ativo: true } }),
      this.prisma.usuario.count({
        where: { contaId, role: 'aluno', ativo: true, ultimoAcesso: { gte: desde } },
      }),
      this.prisma.certificado.count({ where: { contaId } }),
    ]);
    return {
      tipo: 'corporativo',
      totalColaboradores: total,
      ativos7d,
      engajamento: total ? Math.round((ativos7d / total) * 100) : 0,
      trilhasConcluidas,
    };
  }

  async ranking(contaId: string) {
    const grupos = await this.prisma.progresso.groupBy({
      by: ['usuarioId'],
      where: { contaId, concluido: true },
      _count: { _all: true },
      orderBy: { _count: { usuarioId: 'desc' } },
      take: 10,
    });
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: grupos.map((g) => g.usuarioId) } },
      select: { id: true, nome: true },
    });
    const nome = new Map(usuarios.map((u) => [u.id, u.nome]));
    return grupos.map((g) => ({
      usuarioId: g.usuarioId,
      nome: nome.get(g.usuarioId) ?? '—',
      aulasConcluidas: g._count._all,
    }));
  }

  async inativos(contaId: string) {
    const desde = new Date(Date.now() - SETE_DIAS);
    return this.prisma.usuario.findMany({
      where: {
        contaId,
        role: 'aluno',
        ativo: true,
        OR: [{ ultimoAcesso: null }, { ultimoAcesso: { lt: desde } }],
      },
      select: { id: true, nome: true, email: true, ultimoAcesso: true },
    });
  }
}
