import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CortesiaDto, CreateOfertaDto, IntegracaoDto, ProrrogarDto } from './dto';
import { InfoprodutorService } from './infoprodutor.service';

@Controller('painel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class PainelInfoController {
  constructor(private readonly info: InfoprodutorService) {}

  // Ofertas
  @Post('ofertas')
  criarOferta(@CurrentUser() u: AuthUser, @Body() dto: CreateOfertaDto) {
    return this.info.criarOferta(u.contaId!, dto);
  }
  @Get('ofertas')
  ofertas(@CurrentUser() u: AuthUser) {
    return this.info.listarOfertas(u.contaId!);
  }

  // Integrações
  @Put('integracoes')
  definirIntegracao(@CurrentUser() u: AuthUser, @Body() dto: IntegracaoDto) {
    return this.info.definirIntegracao(u.contaId!, dto);
  }
  @Get('integracoes')
  integracoes(@CurrentUser() u: AuthUser) {
    return this.info.listarIntegracoes(u.contaId!);
  }

  // Matrículas
  @Get('matriculas')
  matriculas(@CurrentUser() u: AuthUser) {
    return this.info.listarMatriculas(u.contaId!);
  }
  @Get('alunos-ativos')
  ativos(@CurrentUser() u: AuthUser) {
    return this.info.contarAlunosAtivos(u.contaId!).then((n) => ({ alunosAtivos: n }));
  }
  @Patch('matriculas/:id/inativar')
  inativar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.info.inativarMatricula(u.contaId!, id);
  }
  @Patch('matriculas/:id/reativar')
  reativar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.info.reativarMatricula(u.contaId!, id);
  }
  @Patch('matriculas/:id/prorrogar')
  prorrogar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ProrrogarDto) {
    return this.info.prorrogarMatricula(u.contaId!, id, dto.dias);
  }
  @Post('matriculas/cortesia')
  cortesia(@CurrentUser() u: AuthUser, @Body() dto: CortesiaDto) {
    return this.info.criarCortesia(u.contaId!, dto);
  }
}
