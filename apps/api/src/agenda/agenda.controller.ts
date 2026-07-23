import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AgendaService } from './agenda.service';
import { AtualizarEventoDto, CriarEventoDto } from './dto';

@Controller('painel/eventos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class AgendaPainelController {
  constructor(private readonly agenda: AgendaService) {}

  @Post()
  criar(@CurrentUser() u: AuthUser, @Body() dto: CriarEventoDto) {
    return this.agenda.criar(u, dto);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.agenda.listar(u);
  }

  @Patch(':id')
  atualizar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AtualizarEventoDto) {
    return this.agenda.atualizar(u, id, dto);
  }

  @Delete(':id')
  remover(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.agenda.remover(u, id);
  }
}

@Controller('app/agenda')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.aluno)
export class AgendaAppController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  minha(@CurrentUser() u: AuthUser) {
    return this.agenda.agendaDoAluno(u);
  }
}
