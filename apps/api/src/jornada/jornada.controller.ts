import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JornadaService } from './jornada.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.aluno)
export class JornadaController {
  constructor(private readonly jornada: JornadaService) {}

  @Get('app/jornada')
  get(@CurrentUser() u: AuthUser, @Query('sel') sel?: string) {
    return this.jornada.jornada(u, sel);
  }
}
