import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PublicoController } from './publico.controller';

// PrismaService é global (PrismaModule @Global); StorageModule expõe o StorageService.
@Module({
  imports: [StorageModule],
  controllers: [PublicoController],
})
export class PublicoModule {}
