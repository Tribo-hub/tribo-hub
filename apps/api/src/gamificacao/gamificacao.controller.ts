import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ConfigGamificacaoDto } from './dto';
import { GamificacaoService } from './gamificacao.service';

@Controller('app/conquistas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.aluno)
export class GamificacaoController {
  constructor(private readonly gam: GamificacaoService) {}

  @Get()
  resumo(@CurrentUser() u: AuthUser) {
    return this.gam.resumo(u);
  }

  @Get('trilha/:trilhaId')
  trilha(@CurrentUser() u: AuthUser, @Param('trilhaId') trilhaId: string) {
    return this.gam.resumoTrilha(u, trilhaId);
  }
}

@Controller('painel/gamificacao')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class GamificacaoPainelController {
  constructor(private readonly gam: GamificacaoService) {}

  @Get()
  obter(@CurrentUser() u: AuthUser) {
    return this.gam.obterConfig(u);
  }

  @Put()
  salvar(@CurrentUser() u: AuthUser, @Body() dto: ConfigGamificacaoDto) {
    return this.gam.salvarConfig(u, dto);
  }

  @Get('trilha/:trilhaId')
  obterTrilha(@CurrentUser() u: AuthUser, @Param('trilhaId') trilhaId: string) {
    return this.gam.obterConfigTrilha(u, trilhaId);
  }

  @Put('trilha/:trilhaId')
  salvarTrilha(@CurrentUser() u: AuthUser, @Param('trilhaId') trilhaId: string, @Body() dto: ConfigGamificacaoDto) {
    return this.gam.salvarConfigTrilha(u, trilhaId, dto);
  }
}
