import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AgentesService } from './agentes.service';
import { CreateAgenteDto, CreateAgenteTenantDto } from './dto';

// Super Admin — agentes de plataforma (aparecem para todos os usuários corporativos)
@Controller('admin/agentes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.super_admin)
export class AgentesAdminController {
  constructor(private readonly agentes: AgentesService) {}

  @Get()
  listar() {
    return this.agentes.listarPlataforma();
  }
  @Post()
  criar(@Body() dto: CreateAgenteDto) {
    return this.agentes.criarPlataforma(dto);
  }
  @Delete(':id')
  remover(@Param('id') id: string) {
    return this.agentes.removerPlataforma(id);
  }
}

// Produtor — agentes do próprio tenant, vinculados a trilha(s)
@Controller('painel/agentes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class AgentesPainelController {
  constructor(private readonly agentes: AgentesService) {}

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.agentes.listarTenant(u.contaId!);
  }
  @Post()
  criar(@CurrentUser() u: AuthUser, @Body() dto: CreateAgenteTenantDto) {
    return this.agentes.criarTenant(u.contaId!, dto);
  }
  @Patch(':id')
  atualizar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CreateAgenteTenantDto) {
    return this.agentes.atualizarTenant(u.contaId!, id, dto);
  }
  @Delete(':id')
  remover(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.agentes.removerTenant(u.contaId!, id);
  }
}

// Aluno — agentes disponíveis para ele (global + por trilha)
@Controller('app')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.aluno)
export class AgentesAppController {
  constructor(private readonly agentes: AgentesService) {}

  @Get('agentes')
  meus(@CurrentUser() u: AuthUser) {
    return this.agentes.listarParaAluno(u);
  }
  @Get('trilhas/:id/agentes')
  daTrilha(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.agentes.listarParaTrilha(u, id);
  }
}
