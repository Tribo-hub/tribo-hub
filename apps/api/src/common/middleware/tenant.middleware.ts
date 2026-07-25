import { Injectable, NestMiddleware } from '@nestjs/common';
import { env } from '@tribohub/config';
import { PrismaService } from '../../prisma/prisma.service';

// Resolve o tenant do request, em ordem de prioridade:
//  1. header X-Tenant-Slug (o front estático lê o subdomínio de window.location e o envia,
//     já que o XHR vai para api.tribohub.com.br — cujo Host é "api", reservado);
//  2. subdomínio do domínio base (ex.: acme.tribohub.com.br -> "acme");
//  3. domínio próprio do tenant (ex.: area.cursodele.com -> conta.slug via dominioProprio).
// Subdomínios reservados (admin/app/www/api) e localhost não definem tenant.
const RESERVED = new Set(['admin', 'app', 'www', 'api', 'localhost']);
const CACHE_TTL_MS = 60_000;

// Aceita apenas o formato de slug (a-z, 0-9, hífen) — não confia no header cru.
function slugValido(v: string): string | null {
  const s = v.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(s) && !RESERVED.has(s) ? s : null;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  // cache host -> slug (evita consultar dominioProprio a cada request)
  private readonly cache = new Map<string, { slug: string | null; exp: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async use(req: any, _res: any, next: () => void) {
    // 1. header explícito (front lê o subdomínio/host próprio e envia aqui)
    const header = req.headers['x-tenant-slug'];
    const doHeader = header ? slugValido(String(header)) : null;
    if (doHeader) {
      req.tenantSlug = doHeader;
      return next();
    }
    // 2/3. Host: subdomínio do domínio base ou domínio próprio
    const host = String(req.headers['host'] || '').split(':')[0];
    req.tenantSlug = await this.resolver(host);
    next();
  }

  private async resolver(host: string): Promise<string | null> {
    if (!host || host === 'localhost') return null;

    // subdomínio do domínio base
    if (host.endsWith(env.APP_BASE_DOMAIN)) {
      const sub = host.slice(0, -env.APP_BASE_DOMAIN.length).replace(/\.$/, '');
      return sub && !RESERVED.has(sub) ? sub : null;
    }

    // domínio próprio (consulta com cache)
    const cached = this.cache.get(host);
    if (cached && cached.exp > Date.now()) return cached.slug;

    let slug: string | null = null;
    try {
      const conta = await this.prisma.conta.findUnique({
        where: { dominioProprio: host },
        select: { slug: true, ativo: true },
      });
      slug = conta?.ativo ? conta.slug : null;
    } catch {
      slug = null;
    }
    this.cache.set(host, { slug, exp: Date.now() + CACHE_TTL_MS });
    return slug;
  }
}
