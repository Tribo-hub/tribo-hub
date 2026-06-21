import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { env } from '@tribohub/config';
import { InfoprodutorService } from './infoprodutor.service';
import { WebhookService } from './webhook.service';

@Controller()
export class WebhookController {
  constructor(
    private readonly webhook: WebhookService,
    private readonly info: InfoprodutorService,
  ) {}

  // Público — validado pelo hottok da conta. URL é única por conta.
  @Post('webhooks/hotmart/:contaId')
  @HttpCode(200)
  hotmart(
    @Param('contaId') contaId: string,
    @Headers('x-hotmart-hottok') hottok: string,
    @Body() body: any,
  ) {
    return this.webhook.hotmart(contaId, hottok ?? body?.hottok, body);
  }

  // Cron protegido por segredo — expira matrículas vencidas.
  @Post('internal/matriculas/expirar')
  @HttpCode(200)
  expirar(@Headers('x-cron-secret') secret: string) {
    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.info.expirarMatriculas();
  }
}
