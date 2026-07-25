import { Controller, Get, NotFoundException, Query, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Endpoints PÚBLICOS (sem autenticação) — servem a tela de login/cadastro do aluno
// para exibir a marca do cliente ANTES do login, evitando o "flash" da marca padrão.
// O tenant vem do TenantMiddleware (header X-Tenant-Slug ou Host) e, como fallback,
// dos parâmetros ?tenant= (slug) / ?host= (domínio próprio).
@Controller('publico')
export class PublicoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('marca')
  async marca(
    @Req() req: any,
    @Query('tenant') tenant?: string,
    @Query('host') host?: string,
  ) {
    const slug = req.tenantSlug ?? (tenant?.trim().toLowerCase() || null);

    const conta = slug
      ? await this.prisma.conta.findUnique({ where: { slug } })
      : host
        ? await this.prisma.conta.findUnique({ where: { dominioProprio: host.trim().toLowerCase() } })
        : null;

    if (!conta || !conta.ativo) throw new NotFoundException('Conta não encontrada');

    return {
      slug: conta.slug,
      nome: conta.nome,
      corPrimaria: conta.corPrimaria,
      logoUrl: conta.logoUrl,
      tipoConta: conta.tipoConta,
      permiteAutoCadastro: conta.permiteAutoCadastro,
    };
  }
}
