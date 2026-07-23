import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string) {
    const [itens, naoLidas] = await Promise.all([
      this.prisma.notificacao.findMany({
        where: { usuarioId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.notificacao.count({ where: { usuarioId, lida: false } }),
    ]);
    return { itens, naoLidas };
  }

  async marcarLida(usuarioId: string, id: string) {
    await this.prisma.notificacao.updateMany({ where: { id, usuarioId }, data: { lida: true } });
    return { ok: true };
  }

  async marcarTodas(usuarioId: string) {
    await this.prisma.notificacao.updateMany({ where: { usuarioId, lida: false }, data: { lida: true } });
    return { ok: true };
  }
}
