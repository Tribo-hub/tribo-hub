import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { env } from '@tribohub/config';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermitirInadimplente } from '../common/decorators/permitir-inadimplente.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingService, competenciaAtual } from './billing.service';

// Valida o webhook da Efí (opt-in): só exige o segredo se EFI_WEBHOOK_HMAC estiver configurada.
function webhookEfiAutorizado(hmac?: string): boolean {
  const segredo = env.EFI_WEBHOOK_HMAC;
  if (!segredo) return true; // opt-in: sem segredo, mantém o comportamento atual
  if (!hmac) return false;
  const a = Buffer.from(hmac);
  const b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // Super Admin: visão de faturamento / MRR
  @Get('admin/faturamento')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  listar(@Query('competencia') competencia?: string) {
    return this.billing.listar(competencia || competenciaAtual());
  }

  @Post('admin/faturamento/fechar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  fechar(@Body('competencia') competencia?: string) {
    return this.billing.fecharTodas(competencia || competenciaAtual());
  }

  // Super Admin: emite cobrança Pix (Efí) de uma fatura
  @Post('admin/faturamento/:id/cobrar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  cobrar(@Param('id') id: string) {
    return this.billing.cobrar(id);
  }

  @Patch('admin/faturamento/:id/marcar-paga')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  marcarPaga(@Param('id') id: string) {
    return this.billing.marcarPaga(id);
  }

  // Produtor/Gestor: prévia da própria fatura do mês (acessível mesmo com painel bloqueado, p/ regularizar)
  @Get('painel/minha-fatura')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  @PermitirInadimplente()
  minhaFatura(@CurrentUser() u: AuthUser) {
    return this.billing.calcular(u.contaId!);
  }

  // Fatura em aberto (para a tela de regularização quando o painel está bloqueado)
  @Get('painel/minha-fatura-aberta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  @PermitirInadimplente()
  faturaAberta(@CurrentUser() u: AuthUser) {
    return this.billing.faturaAbertaDaConta(u.contaId!);
  }

  // Validação do webhook: a Efí faz uma requisição na URL base ao registrar — precisa responder 2xx.
  @Get('webhooks/efi')
  @HttpCode(200)
  efiPing() {
    return { ok: true };
  }

  @Get('webhooks/efi/pix')
  @HttpCode(200)
  efiPingPix() {
    return { ok: true };
  }

  // Webhook da Efí: confirma pagamento Pix automaticamente (público; autenticidade por mTLS na Efí).
  @Post('webhooks/efi')
  @HttpCode(200)
  efiWebhookBase(@Body() body: { pix?: Array<{ txid?: string }> }, @Query('hmac') hmac?: string) {
    if (!webhookEfiAutorizado(hmac)) return { ok: false };
    return this.billing.processarWebhookEfi(body);
  }

  @Post('webhooks/efi/pix')
  @HttpCode(200)
  efiWebhook(@Body() body: { pix?: Array<{ txid?: string }> }, @Query('hmac') hmac?: string) {
    if (!webhookEfiAutorizado(hmac)) return { ok: false };
    return this.billing.processarWebhookEfi(body);
  }

  // Cron mensal protegido por segredo
  @Post('internal/faturamento/fechar')
  @HttpCode(200)
  cron(@Headers('x-cron-secret') secret: string, @Body('competencia') competencia?: string) {
    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.billing.fecharTodas(competencia || competenciaAtual());
  }
}
