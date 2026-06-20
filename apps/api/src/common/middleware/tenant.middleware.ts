import { Injectable, NestMiddleware } from '@nestjs/common';
import { env } from '@tribohub/config';

// Resolve o tenant a partir do subdomínio do Host (ex.: acme.tribohub.com.br -> "acme").
// Subdomínios reservados (admin/app/www) e localhost não definem tenant.
const RESERVED = new Set(['admin', 'app', 'www', 'api', 'localhost']);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    const host = String(req.headers['host'] || '').split(':')[0];
    let slug: string | null = null;

    if (host && host !== 'localhost' && host.endsWith(env.APP_BASE_DOMAIN)) {
      const sub = host.slice(0, -env.APP_BASE_DOMAIN.length).replace(/\.$/, '');
      if (sub && !RESERVED.has(sub)) slug = sub;
    }

    req.tenantSlug = slug;
    next();
  }
}
