import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnaliseDto, AtualizarItemDto, AtualizarPlanoDto, CriarItemDto, CriarPlanoDto, ReordenarItensDto, ResponderItemDto } from './dto';
import { PlanosService } from './planos.service';

@Controller('painel/planos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class PlanosPainelController {
  constructor(private readonly planos: PlanosService) {}

  @Post()
  criar(@CurrentUser() u: AuthUser, @Body() dto: CriarPlanoDto) {
    return this.planos.criarPlano(u, dto);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.planos.listarPlanos(u);
  }

  @Get(':id')
  obter(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.planos.obterPlano(u, id);
  }

  @Get(':id/acompanhamento')
  acompanhamento(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.planos.acompanhamentoPlano(u, id);
  }

  @Patch(':id')
  atualizar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AtualizarPlanoDto) {
    return this.planos.atualizarPlano(u, id, dto);
  }

  @Get(':id/alunos/:usuarioId')
  detalheAluno(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('usuarioId') usuarioId: string) {
    return this.planos.detalheAluno(u, id, usuarioId);
  }

  @Patch(':id/alunos/:usuarioId/analise')
  analise(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('usuarioId') usuarioId: string, @Body() dto: AnaliseDto) {
    return this.planos.definirAnalise(u, id, usuarioId, dto);
  }

  @Delete(':id')
  remover(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.planos.removerPlano(u, id);
  }

  @Post(':id/itens')
  adicionarItem(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CriarItemDto) {
    return this.planos.adicionarItem(u, id, dto);
  }

  @Patch(':id/itens/reordenar')
  reordenar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReordenarItensDto) {
    return this.planos.reordenarItens(u, id, dto);
  }

  @Patch('itens/:itemId')
  atualizarItem(@CurrentUser() u: AuthUser, @Param('itemId') itemId: string, @Body() dto: AtualizarItemDto) {
    return this.planos.atualizarItem(u, itemId, dto);
  }

  @Delete('itens/:itemId')
  removerItem(@CurrentUser() u: AuthUser, @Param('itemId') itemId: string) {
    return this.planos.removerItem(u, itemId);
  }
}

@Controller('app/planos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.aluno)
export class PlanosAppController {
  constructor(private readonly planos: PlanosService) {}

  @Get()
  meus(@CurrentUser() u: AuthUser) {
    return this.planos.meusPlanos(u);
  }

  @Get(':id')
  obter(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.planos.obterPlanoAluno(u, id);
  }

  @Patch('itens/:itemId')
  responder(@CurrentUser() u: AuthUser, @Param('itemId') itemId: string, @Body() dto: ResponderItemDto) {
    return this.planos.responderItem(u, itemId, dto);
  }

  @Post(':id/entregar')
  entregar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.planos.entregarPlano(u, id);
  }
}
