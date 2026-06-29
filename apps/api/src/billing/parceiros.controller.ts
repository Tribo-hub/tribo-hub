import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role, StatusComissao } from '@tribohub/db';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParceirosService } from './parceiros.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.super_admin)
export class ParceirosController {
  constructor(private readonly parceiros: ParceirosService) {}

  @Get('parceiros')
  listar() {
    return this.parceiros.listar();
  }

  @Post('parceiros')
  criar(@Body() body: { nome: string; email?: string; documento?: string; chavePix?: string; comissaoPercentual?: number; tiers?: unknown; observacao?: string }) {
    return this.parceiros.criar(body);
  }

  @Get('parceiros/:id')
  obter(@Param('id') id: string) {
    return this.parceiros.obter(id);
  }

  @Patch('parceiros/:id')
  atualizar(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.parceiros.atualizar(id, body);
  }

  @Delete('parceiros/:id')
  remover(@Param('id') id: string) {
    return this.parceiros.remover(id);
  }

  @Post('parceiros/:id/pagar-comissoes')
  pagarTodas(@Param('id') id: string) {
    return this.parceiros.pagarComissoesParceiro(id);
  }

  // Comissões (relatório de payout)
  @Get('comissoes')
  listarComissoes(@Query('status') status?: StatusComissao, @Query('parceiroId') parceiroId?: string, @Query('competencia') competencia?: string) {
    return this.parceiros.listarComissoes({ status, parceiroId, competencia });
  }

  @Post('comissoes/:id/pagar')
  pagar(@Param('id') id: string) {
    return this.parceiros.pagarComissao(id);
  }

  // Parceiro indicador de uma conta
  @Get('contas/:id/parceiro')
  parceiroDaConta(@Param('id') id: string) {
    return this.parceiros.parceiroDaConta(id);
  }

  @Post('contas/:id/parceiro')
  atribuir(@Param('id') id: string, @Body() body: { parceiroId?: string | null; motivo?: string }) {
    return this.parceiros.atribuirParceiro(id, body.parceiroId ?? null, body.motivo);
  }
}
