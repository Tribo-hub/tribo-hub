import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '@tribohub/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    const token = header.slice(7);
    let payload: { sub: string; sid?: string; su?: boolean };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    // Anti-compartilhamento: se a sessão é única, valida que esta ainda é a ativa.
    if (payload.su && payload.sid) {
      const u = await this.prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { sessaoAtual: true },
      });
      if (!u || u.sessaoAtual !== payload.sid) {
        throw new UnauthorizedException('Sessão encerrada: conta acessada em outro dispositivo');
      }
    }

    req.user = payload;
    return true;
  }
}
