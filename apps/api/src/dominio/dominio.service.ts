import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { env } from '@tribohub/config';
import { CloudflareService } from '../cloudflare/cloudflare.service';
import { PrismaService } from '../prisma/prisma.service';

// Domínio próprio self-service do produtor (admin_tenant). Grava Conta.dominioProprio
// e orquestra o custom hostname na Cloudflare (validação + SSL automáticos).
@Injectable()
export class DominioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cf: CloudflareService,
  ) {}

  // Estado atual: domínio salvo + status vindo da Cloudflare + instruções de DNS.
  async status(contaId: string) {
    const conta = await this.prisma.conta.findUnique({
      where: { id: contaId },
      select: { dominioProprio: true },
    });
    const dominio = conta?.dominioProprio ?? null;
    const base = {
      disponivel: this.cf.configurado(),
      alvoCname: this.cf.alvoCname(),
      dominio,
    };
    if (!dominio || !this.cf.configurado()) {
      return { ...base, status: dominio ? 'pendente' : 'sem_dominio', sslStatus: null, registros: [], ativo: false };
    }
    const cf = await this.cf.buscarPorHostname(dominio);
    return { ...base, status: cf.status, sslStatus: cf.sslStatus, registros: cf.registros, ativo: cf.ativo };
  }

  // Define/atualiza o domínio próprio: valida, grava e cria o custom hostname.
  async definir(contaId: string, dominioBruto: string) {
    const dominio = dominioBruto.trim().toLowerCase();
    if (dominio.endsWith(`.${env.APP_BASE_DOMAIN}`) || dominio === env.APP_BASE_DOMAIN) {
      throw new BadRequestException('Para endereços em tribohub.com.br use o subdomínio da conta, não o domínio próprio.');
    }
    const emUso = await this.prisma.conta.findFirst({
      where: { dominioProprio: dominio, NOT: { id: contaId } },
      select: { id: true },
    });
    if (emUso) throw new ConflictException('Este domínio já está vinculado a outra conta.');

    // Se estava trocando de domínio, remove o custom hostname antigo na Cloudflare.
    const atualConta = await this.prisma.conta.findUnique({ where: { id: contaId }, select: { dominioProprio: true } });
    const anterior = atualConta?.dominioProprio ?? null;
    if (anterior && anterior !== dominio && this.cf.configurado()) {
      await this.cf.remover(anterior).catch(() => undefined);
    }

    await this.prisma.conta.update({ where: { id: contaId }, data: { dominioProprio: dominio } });
    const cf = await this.cf.criar(dominio); // idempotente; lança 503 se não configurado
    return {
      disponivel: true,
      alvoCname: this.cf.alvoCname(),
      dominio,
      status: cf.status,
      sslStatus: cf.sslStatus,
      registros: cf.registros,
      ativo: cf.ativo,
    };
  }

  // Reconsulta o status na Cloudflare (após o cliente configurar o DNS).
  verificar(contaId: string) {
    return this.status(contaId);
  }

  // Remove o domínio próprio (limpa o campo e o custom hostname).
  async remover(contaId: string) {
    const conta = await this.prisma.conta.findUnique({ where: { id: contaId }, select: { dominioProprio: true } });
    const dominio = conta?.dominioProprio ?? null;
    if (dominio && this.cf.configurado()) await this.cf.remover(dominio).catch(() => undefined);
    await this.prisma.conta.update({ where: { id: contaId }, data: { dominioProprio: null } });
    return { ok: true };
  }
}
