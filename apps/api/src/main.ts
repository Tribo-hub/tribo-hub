import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { env } from '@tribohub/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { initSentry } from './common/observability';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  initSentry();
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(compression()); // gzip/brotli — reduz o payload no transporte (API US ↔ Brasil)
  // Origens permitidas:
  //  - domínio de marca (APP_URL) e fallback do Pages;
  //  - QUALQUER subdomínio do domínio base (vendas.tribohub.com.br) — Fase 1;
  //  - domínios PRÓPRIOS de cliente cadastrados em Conta.dominioProprio — Fase 2 (lookup + cache).
  const prisma = app.get(PrismaService);
  const origensFixas = new Set([env.APP_URL, 'https://tribohub.pages.dev']);
  const sufixoSub = `.${env.APP_BASE_DOMAIN}`; // ex.: ".tribohub.com.br"
  const cacheDom = new Map<string, { ok: boolean; exp: number }>(); // host -> permitido?
  const DOM_TTL = 60_000;

  async function dominioProprioValido(host: string): Promise<boolean> {
    const c = cacheDom.get(host);
    if (c && c.exp > Date.now()) return c.ok;
    let ok = false;
    try {
      const conta = await prisma.conta.findUnique({ where: { dominioProprio: host }, select: { ativo: true } });
      ok = !!conta?.ativo;
    } catch {
      ok = false;
    }
    cacheDom.set(host, { ok, exp: Date.now() + DOM_TTL });
    return ok;
  }

  app.enableCors({
    credentials: true,
    origin(origin, cb) {
      // requests sem Origin (curl, server-to-server, webhooks) passam
      if (!origin) return cb(null, true);
      if (origensFixas.has(origin)) return cb(null, true);
      let host: string;
      try {
        host = new URL(origin).hostname;
      } catch {
        return cb(new Error('Origem não permitida pelo CORS'), false);
      }
      // subdomínio do domínio base (qualquer cliente) — inclui o próprio domínio base
      if (host === env.APP_BASE_DOMAIN || host.endsWith(sufixoSub)) return cb(null, true);
      // domínio próprio de cliente (Fase 2)
      dominioProprioValido(host).then((ok) =>
        ok ? cb(null, true) : cb(new Error('Origem não permitida pelo CORS'), false),
      );
    },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Railway/host injeta PORT; em dev cai para a porta do API_URL (3333)
  const port = Number(process.env.PORT) || Number(new URL(env.API_URL).port || 3333);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 API Tribo Hub ouvindo na porta ${port}`);
}

bootstrap();
