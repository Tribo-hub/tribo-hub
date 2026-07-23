import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
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

  // Kiwify/Eduzz: segredo via querystring (?token=) — configure a URL com ?token=SEGREDO.
  @Post('webhooks/kiwify/:contaId')
  @HttpCode(200)
  kiwify(
    @Param('contaId') contaId: string,
    @Query('token') token: string,
    @Headers('x-kiwify-token') header: string,
    @Body() body: any,
  ) {
    return this.webhook.kiwify(contaId, token ?? header ?? body?.token, body);
  }

  @Post('webhooks/eduzz/:contaId')
  @HttpCode(200)
  eduzz(
    @Param('contaId') contaId: string,
    @Query('token') token: string,
    @Headers('x-eduzz-token') header: string,
    @Body() body: any,
  ) {
    return this.webhook.eduzz(contaId, token ?? header ?? body?.token, body);
  }

  // Checkout Efí (via middleware do produtor). Caminho distinto de /webhooks/efi[/pix]
  // (esses são do billing da assinatura). Segurança por HMAC no header x-efi-assinatura.
  @Post('webhooks/efi-produto/:contaId')
  @HttpCode(200)
  efi(
    @Param('contaId') contaId: string,
    @Headers('x-efi-assinatura') assinatura: string,
    @Body() body: any,
  ) {
    return this.webhook.efi(contaId, assinatura, body);
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
