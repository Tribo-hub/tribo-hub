import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        contaId: true,
        avatarUrl: true,
        ultimoAcesso: true,
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async updateMe(userId: string, data: { nome?: string; avatarUrl?: string }) {
    return this.prisma.usuario.update({
      where: { id: userId },
      data: { nome: data.nome, avatarUrl: data.avatarUrl },
      select: { id: true, nome: true, email: true, role: true, avatarUrl: true },
    });
  }
}
