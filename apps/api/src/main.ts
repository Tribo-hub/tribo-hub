import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { env } from '@tribohub/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: [env.APP_URL], credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const port = Number(new URL(env.API_URL).port || 3333);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API Tribo Hub rodando em ${env.API_URL}/api`);
}

bootstrap();
