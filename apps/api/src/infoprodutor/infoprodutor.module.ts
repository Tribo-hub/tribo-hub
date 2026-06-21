import { Module } from '@nestjs/common';
import { InfoprodutorService } from './infoprodutor.service';
import { PainelInfoController } from './painel-info.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [PainelInfoController, WebhookController],
  providers: [InfoprodutorService, WebhookService],
  exports: [InfoprodutorService],
})
export class InfoprodutorModule {}
