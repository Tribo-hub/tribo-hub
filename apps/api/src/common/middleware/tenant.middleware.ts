import { Injectable, NestMiddleware } from '@nestjs/common';
import { env } from '@tribohub/config';
import { PrismaService } from '../../prisma/prisma.service';

// Resolve o tenant pelo Host:
//  - subdomínio do domínio base (ex.: acme.tribohub.com.br -> "acme");
//  - OU domínio próprio do tenant (ex.: area.cursodele.com -> conta.slug via dominioProprio).
// Subdomínios reservados (admin/app/www/api) e localhost não definem tenant.
const RESERVED = new Set(['admin', 'app', 'www', 'api', 'localhost']);
const CACHE_TTL_MS = 60_000;

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  // cache host -> slug (evita consultar dominioProprio a cada request)
  private readonly cache = new Map<string, { slug: string | null; exp: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async use(req: any, _res: any, next: () => void) {
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
