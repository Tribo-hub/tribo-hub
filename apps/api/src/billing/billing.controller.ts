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
import { env } from '@tribohub/config';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingService, competenciaAtual } from './billing.service';

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

  // Produtor/Gestor: prévia da própria fatura do mês
  @Get('painel/minha-fatura')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  minhaFatura(@CurrentUser() u: AuthUser) {
    return this.billing.calcular(u.contaId!);
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
