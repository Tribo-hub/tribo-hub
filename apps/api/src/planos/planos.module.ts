import { Module } from '@nestjs/common';
import { GamificacaoModule } from '../gamificacao/gamificacao.module';
import { StorageModule } from '../storage/storage.module';
import { PlanosAppController, PlanosPainelController } from './planos.controller';
import { PlanosService } from './planos.service';

@Module({
  imports: [GamificacaoModule, StorageModule],
  controllers: [PlanosPainelController, PlanosAppController],
  providers: [PlanosService],
  exports: [PlanosService],
})
export class PlanosModule {}
