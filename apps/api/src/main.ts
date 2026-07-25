import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { env } from '@tribohub/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { initSentry } from './common/observability';

async function bootstrap() {
  initSentry();
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  // Origens permitidas: domínio de marca (APP_URL), fallback do Pages e QUALQUER
  // subdomínio do domínio base (área de membros por cliente: vendas.tribohub.com.br).
  const origensFixas = new Set([env.APP_URL, 'https://tribohub.pages.dev']);
  const sufixoSub = `.${env.APP_BASE_DOMAIN}`; // ex.: ".tribohub.com.br"
  app.enableCors({
    credentials: true,
    origin(origin, cb) {
      // requests sem Origin (curl, server-to-server, webhooks) passam
      if (!origin) return cb(null, true);
      if (origensFixas.has(origin)) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        // subdomínio do domínio base (qualquer cliente) — inclui o próprio domínio base
        if (host === env.APP_BASE_DOMAIN || host.endsWith(sufixoSub)) return cb(null, true);
      } catch {
        /* origin malformado */
      }
      return cb(new Error('Origem não permitida pelo CORS'), false);
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
