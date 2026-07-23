import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AlunoService } from './aluno.service';
import { AvaliacaoDto, ComentarioDto, ProgressoDto, ResponderQuizDto } from './dto/progresso.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.aluno)
export class AlunoController {
  constructor(private readonly aluno: AlunoService) {}

  @Get('app/trilhas')
  trilhas(@CurrentUser() u: AuthUser) {
    return this.aluno.listarTrilhas(u);
  }

  @Get('app/ofertas')
  ofertas(@CurrentUser() u: AuthUser) {
    return this.aluno.listarVitrine(u);
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

  @Post('app/aulas/:id/avaliacao')
  avaliar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AvaliacaoDto) {
    return this.aluno.avaliarAula(u, id, dto.nota);
  }

  @Get('app/aulas/:id/quiz')
  quiz(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.aluno.obterQuiz(u, id);
  }

  @Post('app/aulas/:id/quiz')
  responderQuiz(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ResponderQuizDto) {
    return this.aluno.responderQuiz(u, id, dto.respostas);
  }

  @Get('app/aulas/:id/comentarios')
  comentarios(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.aluno.listarComentarios(u, id);
  }

  @Post('app/aulas/:id/comentarios')
  comentar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ComentarioDto) {
    return this.aluno.comentar(u, id, dto.texto, dto.respostaAId);
  }

  @Delete('app/comentarios/:id')
  removerComentario(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.aluno.removerComentario(u, id);
  }

  @Get('me/progresso')
  meusProgressos(@CurrentUser() u: AuthUser) {
    return this.aluno.meusProgressos(u);
  }

  @Get('me/certificados')
  meusCertificados(@CurrentUser() u: AuthUser) {
    return this.aluno.meusCertificados(u);
  }

  @Get('me/certificados/:id/download')
  baixarCertificado(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.aluno.baixarCertificado(u, id);
  }
}
