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
  CriarPerguntaDto,
  ResponderComentarioDto,
  TurmaDto,
  UpdateAulaDto,
  UpdateModuloDto,
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

  @Post('trilhas/reordenar')
  reordenarTrilhas(@CurrentUser() u: AuthUser, @Body('ids') ids: string[]) {
    return this.conteudo.reordenarTrilhas(u, ids);
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

  // Turmas
  @Get('trilhas/:id/turmas')
  listarTurmas(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.listarTurmas(u, id);
  }

  @Post('trilhas/:id/turmas')
  criarTurma(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TurmaDto) {
    return this.conteudo.criarTurma(u, id, dto);
  }

  @Patch('turmas/:id')
  atualizarTurma(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TurmaDto) {
    return this.conteudo.atualizarTurma(u, id, dto);
  }

  @Delete('turmas/:id')
  removerTurma(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.removerTurma(u, id);
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
    @Body() dto: UpdateModuloDto,
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
    @Body() dto: UpdateAulaDto,
  ) {
    return this.conteudo.atualizarAula(u, id, dto);
  }

  @Delete('aulas/:id')
  removerAula(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.removerAula(u, id);
  }

  // Quiz da aula
  @Get('aulas/:id/perguntas')
  listarPerguntas(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.listarPerguntas(u, id);
  }

  @Post('aulas/:id/perguntas')
  criarPergunta(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CriarPerguntaDto) {
    return this.conteudo.criarPergunta(u, id, dto.pergunta);
  }

  @Delete('perguntas/:id')
  removerPergunta(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.removerPergunta(u, id);
  }

  @Get('perguntas/:id/respostas')
  listarRespostas(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.listarRespostas(u, id);
  }

  // Comentários da aula (moderação/resposta do produtor)
  @Get('aulas/:id/comentarios')
  listarComentarios(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.listarComentariosAula(u, id);
  }

  @Post('aulas/:id/comentarios')
  responderComentario(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ResponderComentarioDto) {
    return this.conteudo.responderComentario(u, id, dto.texto, dto.respostaAId);
  }

  @Delete('comentarios/:id')
  removerComentario(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.conteudo.removerComentarioModeracao(u, id);
  }
}
