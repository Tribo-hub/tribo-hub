import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ConteudoService } from './conteudo.service';
import {
  CreateAulaDto,
  CreateModuloDto,
  CreateTrilhaDto,
  UpdateTrilhaDto,
} from './dto/conteudo.dto';

@Controller('painel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.super_admin, Role.admin_tenant)
export class ConteudoController {
  constructor(private readonly conteudo: ConteudoService) {}

  // Trilhas
  @Post('trilhas')
  criarTrilha(@CurrentUser() u: AuthUser, @Body() dto: CreateTrilhaDto) {
    return this.conteudo.criarTrilha(u, dto);
  }

  @Get('trilhas')
  listarTrilhas(@CurrentUser() u: AuthUser) {
    return this.conteudo.listarTrilhas(u);
  }

  @Get('trilhas/:id')
  obterTrilha(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.obterTrilha(u, id);
  }

  @Patch('trilhas/:id')
  atualizarTrilha(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTrilhaDto,
  ) {
    return this.conteudo.atualizarTrilha(u, id, dto);
  }

  @Delete('trilhas/:id')
  removerTrilha(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.removerTrilha(u, id);
  }

  // Módulos
  @Post('trilhas/:trilhaId/modulos')
  criarModulo(
    @CurrentUser() u: AuthUser,
    @Param('trilhaId') trilhaId: string,
    @Body() dto: CreateModuloDto,
  ) {
    return this.conteudo.criarModulo(u, trilhaId, dto);
  }

  @Patch('modulos/:id')
  atualizarModulo(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateModuloDto,
  ) {
    return this.conteudo.atualizarModulo(u, id, dto);
  }

  @Delete('modulos/:id')
  removerModulo(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.removerModulo(u, id);
  }

  // Aulas
  @Post('modulos/:moduloId/aulas')
  criarAula(
    @CurrentUser() u: AuthUser,
    @Param('moduloId') moduloId: string,
    @Body() dto: CreateAulaDto,
  ) {
    return this.conteudo.criarAula(u, moduloId, dto);
  }

  @Patch('aulas/:id')
  atualizarAula(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateAulaDto,
  ) {
    return this.conteudo.atualizarAula(u, id, dto);
  }

  @Delete('aulas/:id')
  removerAula(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.removerAula(u, id);
  }
}
