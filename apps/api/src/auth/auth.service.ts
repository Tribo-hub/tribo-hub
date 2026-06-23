import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '@tribohub/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 30;
const RESET_VALIDADE_MIN = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  static async hashSenha(senha: string): Promise<string> {
    return bcrypt.hash(senha, 12);
  }

  async login(email: string, senha: string, tenantSlug: string | null) {
    const emailNorm = email.trim().toLowerCase();

    // Resolve a conta pelo subdomínio; sem tenant => contexto de super_admin (contaId null)
    let contaId: string | null = null;
    if (tenantSlug) {
      const conta = await this.prisma.conta.findUnique({ where: { slug: tenantSlug } });
      if (!conta || !conta.ativo) throw new UnauthorizedException('Conta inválida');
      contaId = conta.id;
    }

    const user = await this.prisma.usuario.findFirst({
      where: { email: emailNorm, contaId },
    });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    if (user.bloqueadoAte && user.bloqueadoAte > new Date()) {
      throw new HttpException(
        'Conta temporariamente bloqueada. Tente mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!user.ativo) throw new ForbiddenException('Usuário inativo');

    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) {
      const tentativas = user.tentativasFalhas + 1;
      const bloquear = tentativas >= MAX_TENTATIVAS;
      await this.prisma.usuario.update({
        where: { id: user.id },
        data: {
          tentativasFalhas: bloquear ? 0 : tentativas,
          bloqueadoAte: bloquear
            ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000)
            : undefined,
        },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoAcesso: new Date() },
    });

    const tokens = await this.emitirTokens(user.id, user.role, user.contaId);
    return {
      ...tokens,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        contaId: user.contaId,
      },
    };
  }

  // Auto-cadastro do aluno (infoprodutor), quando a conta permite.
  async signup(nome: string, email: string, senha: string, tenantSlug: string | null) {
    if (!tenantSlug) throw new BadRequestException('Conta (tenant) é obrigatória');
    const conta = await this.prisma.conta.findUnique({ where: { slug: tenantSlug } });
    if (!conta || !conta.ativo) throw new BadRequestException('Conta inválida');
    if (conta.tipoConta !== 'infoprodutor' || !conta.permiteAutoCadastro) {
      throw new ForbiddenException('Auto-cadastro não disponível para esta conta');
    }
    const emailNorm = email.trim().toLowerCase();
    const existente = await this.prisma.usuario.findFirst({
      where: { email: emailNorm, contaId: conta.id },
    });
    if (existente) throw new BadRequestException('Já existe um cadastro com este e-mail');

    const senhaHash = await AuthService.hashSenha(senha);
    const user = await this.prisma.usuario.create({
      data: { contaId: conta.id, nome: nome.trim() || emailNorm, email: emailNorm, senhaHash, role: 'aluno' },
    });
    const tokens = await this.emitirTokens(user.id, user.role, user.contaId);
    return {
      ...tokens,
      usuario: { id: user.id, nome: user.nome, email: user.email, role: user.role, contaId: user.contaId },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
    const user = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!user || !user.ativo) throw new UnauthorizedException('Usuário inválido');
    return this.emitirTokens(user.id, user.role, user.contaId);
  }

  async aceitarConvite(token: string, senha: string) {
    const convite = await this.prisma.inviteToken.findUnique({ where: { token } });
    if (!convite || convite.usado || convite.expiraEm < new Date()) {
      throw new BadRequestException('Convite inválido ou expirado');
    }
    const user = await this.prisma.usuario.findFirst({
      where: { email: convite.email.toLowerCase(), contaId: convite.contaId },
    });
    if (!user) throw new NotFoundException('Usuário do convite não encontrado');

    const senhaHash = await AuthService.hashSenha(senha);
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: user.id }, data: { senhaHash, ativo: true } }),
      this.prisma.inviteToken.update({ where: { id: convite.id }, data: { usado: true } }),
    ]);
    return { ok: true };
  }

  // Solicita redefinição de senha. Resposta é sempre ok (não revela se o e-mail existe).
  async solicitarResetSenha(email: string, tenantSlug: string | null) {
    const emailNorm = email.trim().toLowerCase();
    let contaId: string | null = null;
    if (tenantSlug) {
      const conta = await this.prisma.conta.findUnique({ where: { slug: tenantSlug } });
      if (!conta) return { ok: true }; // tenant inválido — não revela nada
      contaId = conta.id;
    }
    const user = await this.prisma.usuario.findFirst({ where: { email: emailNorm, contaId } });
    if (user && user.ativo) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          usuarioId: user.id,
          token,
          expiraEm: new Date(Date.now() + RESET_VALIDADE_MIN * 60_000),
        },
      });
      try {
        await this.email.recuperacaoSenha(user.email, user.nome, token);
      } catch {
        // falha de e-mail não vaza estado ao cliente
      }
    }
    return { ok: true };
  }

  async redefinirSenha(token: string, senha: string) {
    const t = await this.prisma.passwordResetToken.findUnique({ where: { token } });
    if (!t || t.usado || t.expiraEm < new Date()) {
      throw new BadRequestException('Link inválido ou expirado');
    }
    const senhaHash = await AuthService.hashSenha(senha);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: t.usuarioId },
        data: { senhaHash, tentativasFalhas: 0, bloqueadoAte: null },
      }),
      this.prisma.passwordResetToken.update({ where: { id: t.id }, data: { usado: true } }),
    ]);
    return { ok: true };
  }

  private async emitirTokens(sub: string, role: string, contaId: string | null) {
    const accessToken = await this.jwt.signAsync(
      { sub, role, contaId },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: env.JWT_ACCESS_EXPIRES },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_EXPIRES },
    );
    return { accessToken, refreshToken };
  }
}
