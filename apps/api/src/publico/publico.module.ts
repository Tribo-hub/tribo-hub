import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller';

// PrismaService é global (PrismaModule @Global) — não precisa importar aqui.
@Module({
  controllers: [PublicoController],
})
export class PublicoModule {}
