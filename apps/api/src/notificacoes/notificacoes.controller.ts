import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificacoesService } from './notificacoes.service';

@Controller('me/notificacoes')
@UseGuards(JwtAuthGuard)
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.notificacoes.listar(u.sub);
  }

  @Patch('marcar-todas')
  marcarTodas(@CurrentUser() u: AuthUser) {
    return this.notificacoes.marcarTodas(u.sub);
  }

  @Patch(':id/lida')
  marcarLida(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.notificacoes.marcarLida(u.sub, id);
  }
}
