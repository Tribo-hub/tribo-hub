import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/decorators/current-user.decorator';
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
        telefone: true,
        role: true,
        contaId: true,
        avatarUrl: true,
        ultimoAcesso: true,
        conta: {
          select: {
            tipoConta: true,
            nome: true,
            corPrimaria: true,
            logoUrl: true,
            boasVindasAtivo: true,
            mensagemBoasVindas: true,
            agendaAtiva: true,
            planosAtivos: true,
            gamificacaoAtiva: true,
          },
        },
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
    // avatar do aluno (caminho do Storage) -> assina p/ exibição
    if (user.avatarUrl && !user.avatarUrl.startsWith('http')) {
      try {
        user.avatarUrl = (await this.storage.urlDeDownload(user.avatarUrl)).url;
      } catch {
        user.avatarUrl = null;
      }
    }
    return user;
  }

  async updateMe(userId: string, data: { nome?: string; email?: string; telefone?: string; avatarUrl?: string }) {
    const atual = await this.prisma.usuario.findUnique({ where: { id: userId }, select: { contaId: true } });
    if (!atual) throw new NotFoundException('Usuário não encontrado');

    const email = data.email?.trim().toLowerCase();
    if (email) {
      const conflito = await this.prisma.usuario.findFirst({
        where: { email, contaId: atual.contaId, NOT: { id: userId } },
        select: { id: true },
      });
      if (conflito) throw new ConflictException('Este e-mail já está em uso nesta conta.');
    }

    return this.prisma.usuario.update({
      where: { id: userId },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
        ...(email ? { email } : {}),
        ...(data.telefone !== undefined ? { telefone: data.telefone || null } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || null } : {}),
      },
      select: { id: true, nome: true, email: true, telefone: true, role: true, avatarUrl: true },
    });
  }

  // Troca de senha do próprio usuário: confere a senha atual e grava a nova.
  async alterarSenha(userId: string, senhaAtual: string, novaSenha: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId }, select: { senhaHash: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const ok = await bcrypt.compare(senhaAtual, user.senhaHash);
    if (!ok) throw new UnauthorizedException('Senha atual incorreta.');
    if (await bcrypt.compare(novaSenha, user.senhaHash)) {
      throw new BadRequestException('A nova senha deve ser diferente da atual.');
    }
    const senhaHash = await bcrypt.hash(novaSenha, 12);
    await this.prisma.usuario.update({ where: { id: userId }, data: { senhaHash } });
    return { ok: true };
  }

  // URL assinada para o próprio usuário subir o avatar (qualquer papel, inclusive aluno).
  async urlAvatarUpload(user: AuthUser, nomeArquivo: string) {
    const base = user.contaId ?? 'plataforma';
    const seguro = nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${base}/avatares/${user.sub}-${Date.now()}-${seguro}`;
    return this.storage.urlDeUpload(path);
  }
}
