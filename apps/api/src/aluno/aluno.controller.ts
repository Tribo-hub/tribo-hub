import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AlunoService } from './aluno.service';
import { ProgressoDto } from './dto/progresso.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.aluno)
export class AlunoController {
  constructor(private readonly aluno: AlunoService) {}

  @Get('app/trilhas')
  trilhas(@CurrentUser() u: AuthUser) {
    return this.aluno.listarTrilhas(u);
  }

  @Get('app/trilhas/:id')
  trilha(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.aluno.obterTrilha(u, id);
  }

  @Get('app/trilhas/:id/proxima-aula')
  proxima(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.aluno.proximaAula(u, id);
  }

  @Post('app/progresso')
  progresso(@CurrentUser() u: AuthUser, @Body() dto: ProgressoDto) {
    return this.aluno.registrarProgresso(u, dto);
  }

  @Get('me/progresso')
  meusProgressos(@CurrentUser() u: AuthUser) {
    return this.aluno.meusProgressos(u);
  }

  @Get('me/certificados')
  meusCertificados(@CurrentUser() u: AuthUser) {
    return this.aluno.meusCertificados(u);
  }
}
