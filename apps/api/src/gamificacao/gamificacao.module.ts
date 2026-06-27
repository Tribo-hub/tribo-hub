import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { GamificacaoController, GamificacaoPainelController } from './gamificacao.controller';
import { GamificacaoService } from './gamificacao.service';

@Module({
  imports: [StorageModule],
  controllers: [GamificacaoController, GamificacaoPainelController],
  providers: [GamificacaoService],
  exports: [GamificacaoService],
})
export class GamificacaoModule {}
