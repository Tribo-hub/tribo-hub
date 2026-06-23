import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
        conta: { select: { tipoConta: true, nome: true, corPrimaria: true, logoUrl: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    // logo enviado ao Storage (caminho privado) -> assina p/ exibição; URL externa fica como está
    if (user.conta?.logoUrl && !user.conta.logoUrl.startsWith('http')) {
      try {
        user.conta.logoUrl = (await this.storage.urlDeDownload(user.conta.logoUrl)).url;
      } catch {
        user.conta.logoUrl = null;
      }
    }
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
