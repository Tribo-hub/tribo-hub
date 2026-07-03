import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EquipeService } from './equipe.service';

// Funcionários da conta (bastidor). Só o DONO acessa (o EquipeGuard global bloqueia gerente/atendente aqui).
@Controller('painel/funcionarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class EquipeController {
  constructor(private readonly equipe: EquipeService) {}

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.equipe.listar(u.contaId!);
  }

  @Post()
  convidar(@CurrentUser() u: AuthUser, @Body() body: { nome: string; email: string; funcao: string }) {
    return this.equipe.convidar(u.contaId!, body);
  }

  @Patch(':id')
  atualizar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: { funcao?: string; ativo?: boolean }) {
    return this.equipe.atualizar(u.contaId!, id, body);
  }

  @Delete(':id')
  remover(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.equipe.remover(u.contaId!, id);
  }
}
