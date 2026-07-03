import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '@tribohub/config';

// Guard GLOBAL: restringe o acesso dos FUNCIONÁRIOS (equipe) do infoprodutor/empresa.
// - dono (admin_tenant sem eq): acesso total.
// - gerente (eq='gerente'): tudo, MENOS gerir funcionários e assinatura.
// - atendente (eq='atendente'): só atendimento (matrículas/alunos/dashboard/perfil).
// super_admin, aluno e rotas sem token passam (auth fica a cargo do JwtAuthGuard).
// Decodifica o token por conta própria porque guards globais rodam antes do JwtAuthGuard.
const DONO_ONLY = ['/painel/funcionarios', '/painel/assinatura'];
const ATENDENTE_ALLOW = ['/me', '/painel/matriculas', '/painel/alunos', '/painel/alunos-ativos', '/painel/dashboard'];

@Injectable()
export class EquipeGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.['authorization'];
    if (!header?.startsWith('Bearer ')) return true;

    let payload: { role?: string; eq?: string | null };
    try {
      payload = await this.jwt.verifyAsync(header.slice(7), { secret: env.JWT_ACCESS_SECRET });
    } catch {
      return true; // token inválido: o JwtAuthGuard responde 401
    }

    if (payload.role !== 'admin_tenant' || !payload.eq) return true; // dono/super_admin/aluno

    // caminho sem o prefixo global /api
    const raw = (req.path ?? req.url ?? '').split('?')[0] as string;
    const path = raw.replace(/^\/api/, '');

    // funcionários (gerente e atendente) não gerenciam equipe nem assinatura
    if (DONO_ONLY.some((p) => path.startsWith(p))) {
      throw new ForbiddenException({ code: 'SEM_PERMISSAO', message: 'Apenas o dono da conta pode acessar esta área.' });
    }

    // atendente: só as áreas de atendimento
    if (payload.eq === 'atendente' && !ATENDENTE_ALLOW.some((p) => path.startsWith(p))) {
      throw new ForbiddenException({ code: 'SEM_PERMISSAO', message: 'Seu perfil (atendente) não tem acesso a esta área.' });
    }
    return true;
  }
}
