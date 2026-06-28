import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { env } from '@tribohub/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMITIR_INADIMPLENTE } from '../decorators/permitir-inadimplente.decorator';

// Guard GLOBAL: bloqueia o acesso conforme o estado de inadimplência da conta.
// - admin_tenant (produtor/empresa): bloqueado quando painelBloqueado (15 dias).
// - aluno: bloqueado quando alunosBloqueados (30 dias).
// super_admin e rotas públicas (sem token) passam. Decodifica o token por conta própria
// porque guards globais rodam antes do JwtAuthGuard das rotas — não enforça auth (isso é
// responsabilidade do JwtAuthGuard), apenas lê o token quando presente.
@Injectable()
export class SubscriptionStatusGuard implements CanActivate {
  // cache curto contaId -> flags, para não consultar o banco a cada request
  private readonly cache = new Map<string, { painel: boolean; alunos: boolean; exp: number }>();
  private readonly TTL = 30_000;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rota isenta (ver fatura/pagar/perfil)?
    const isento = this.reflector.getAllAndOverride<boolean>(PERMITIR_INADIMPLENTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isento) return true;

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.['authorization'];
    if (!header?.startsWith('Bearer ')) return true; // sem token: rota pública ou o JwtAuthGuard cuida

    let payload: { role?: string; contaId?: string | null };
    try {
      payload = await this.jwt.verifyAsync(header.slice(7), { secret: env.JWT_ACCESS_SECRET });
    } catch {
      return true; // token inválido: deixa o JwtAuthGuard responder 401
    }

    const { role, contaId } = payload;
    if (!contaId || role === 'super_admin') return true;
    if (role !== 'admin_tenant' && role !== 'aluno') return true;

    const flags = await this.flags(contaId);
    if (role === 'admin_tenant' && flags.painel) {
      throw new ForbiddenException({ code: 'PAINEL_BLOQUEADO', message: 'Conta com pagamento pendente. Regularize para continuar.' });
    }
    if (role === 'aluno' && flags.alunos) {
      throw new ForbiddenException({ code: 'ALUNOS_BLOQUEADOS', message: 'Acesso temporariamente suspenso. Fale com o responsável pela plataforma.' });
    }
    return true;
  }

  private async flags(contaId: string): Promise<{ painel: boolean; alunos: boolean }> {
    const c = this.cache.get(contaId);
    if (c && c.exp > Date.now()) return { painel: c.painel, alunos: c.alunos };
    const ass = await this.prisma.assinaturaPlataforma.findUnique({
      where: { contaId },
      select: { painelBloqueado: true, alunosBloqueados: true },
    });
    const painel = !!ass?.painelBloqueado;
    const alunos = !!ass?.alunosBloqueados;
    this.cache.set(contaId, { painel, alunos, exp: Date.now() + this.TTL });
    return { painel, alunos };
  }
}
