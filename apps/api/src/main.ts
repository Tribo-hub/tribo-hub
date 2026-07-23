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
  // Origens permitidas: domínio de marca (APP_URL) + fallback do Pages durante a transição
  const origensCors = [...new Set([env.APP_URL, 'https://tribohub.pages.dev'])];
  app.enableCors({ origin: origensCors, credentials: true });
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
