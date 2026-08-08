import { Body, Controller, Delete, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DefinirDominioDto } from './dominio.dto';
import { DominioService } from './dominio.service';

// Domínio próprio self-service do produtor. Restrito ao dono da conta pelo EquipeGuard
// (funcionários não alteram domínio — ver common/guards/equipe.guard.ts DONO_ONLY).
@Controller('painel/dominio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class DominioController {
  constructor(private readonly dominio: DominioService) {}

  @Get()
  status(@CurrentUser() u: AuthUser) {
    return this.dominio.status(u.contaId!);
  }

  @Put()
  definir(@CurrentUser() u: AuthUser, @Body() dto: DefinirDominioDto) {
    return this.dominio.definir(u.contaId!, dto.dominio);
  }

  @Post('verificar')
  @HttpCode(200)
  verificar(@CurrentUser() u: AuthUser) {
    return this.dominio.verificar(u.contaId!);
  }

  @Delete()
  remover(@CurrentUser() u: AuthUser) {
    return this.dominio.remover(u.contaId!);
  }
}
