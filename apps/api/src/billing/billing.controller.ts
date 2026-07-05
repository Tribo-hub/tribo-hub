import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { env } from '@tribohub/config';
import { Role, TipoConta } from '@tribohub/db';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermitirInadimplente } from '../common/decorators/permitir-inadimplente.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingService, competenciaAtual } from './billing.service';

// Valida o webhook da Efí (opt-in): só exige o segredo se EFI_WEBHOOK_HMAC estiver configurada.
function webhookEfiAutorizado(hmac?: string): boolean {
  const segredo = env.EFI_WEBHOOK_HMAC;
  if (!segredo) return true; // opt-in: sem segredo, mantém o comportamento atual
  if (!hmac) return false;
  const a = Buffer.from(hmac);
  const b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // Super Admin: visão de faturamento / MRR
  @Get('admin/faturamento')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  listar(@Query('competencia') competencia?: string) {
    return this.billing.listar(competencia || competenciaAtual());
  }

  @Post('admin/faturamento/fechar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  fechar(@Body('competencia') competencia?: string) {
    return this.billing.fecharTodas(competencia || competenciaAtual());
  }

  // Super Admin: emite cobrança Pix (Efí) de uma fatura
  @Post('admin/faturamento/:id/cobrar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  cobrar(@Param('id') id: string) {
    return this.billing.cobrar(id);
  }

  @Patch('admin/faturamento/:id/marcar-paga')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  marcarPaga(@Param('id') id: string) {
    return this.billing.marcarPaga(id);
  }

  // Super Admin: emite um boleto (Efí Cobranças) de uma fatura
  @Post('admin/faturamento/:id/boleto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  boleto(@Param('id') id: string, @Body() body: { nome: string; email: string; documento: string; telefone?: string; razaoSocial?: string }) {
    const doc = (body.documento ?? '').replace(/\D/g, '');
    return this.billing.emitirBoleto(id, {
      nome: body.nome,
      email: body.email,
      telefone: body.telefone,
      ...(doc.length > 11 ? { cnpj: doc, razaoSocial: body.razaoSocial || body.nome } : { cpf: doc }),
    });
  }

  // Super Admin: dashboard financeiro (MRR/ARR/churn/ticket/inadimplência/MRR 6m)
  @Get('admin/financeiro/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  dashboard(@Query('competencia') competencia?: string) {
    return this.billing.dashboard(competencia || competenciaAtual());
  }

  // Super Admin: desconto recorrente por conta
  @Post('admin/contas/:id/desconto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  definirDesconto(@Param('id') id: string, @Body() body: { tipo: 'percentual' | 'fixo'; valor: number; ate?: string | null; motivo?: string }) {
    return this.billing.definirDesconto(id, body);
  }

  @Delete('admin/contas/:id/desconto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  removerDesconto(@Param('id') id: string) {
    return this.billing.removerDesconto(id);
  }

  // Super Admin: cobrança avulsa (fora do ciclo) com Pix
  @Post('admin/contas/:id/cobranca-avulsa')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  cobrancaAvulsa(@Param('id') id: string, @Body() body: { valor: number; observacao?: string }) {
    return this.billing.cobrancaAvulsa(id, Number(body.valor), body.observacao);
  }

  // Super Admin: notas internas por conta
  @Get('admin/contas/:id/notas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  listarNotas(@Param('id') id: string) {
    return this.billing.listarNotas(id);
  }

  @Post('admin/contas/:id/notas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  adicionarNota(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('texto') texto: string) {
    return this.billing.adicionarNota(id, u.sub, texto);
  }

  @Delete('admin/notas/:notaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  removerNota(@Param('notaId') notaId: string) {
    return this.billing.removerNota(notaId);
  }

  // ===== Catálogo de planos (Super Admin) =====
  @Get('admin/planos-catalogo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  listarCatalogo() {
    return this.billing.listarCatalogo();
  }

  @Post('admin/planos-catalogo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  criarCatalogo(@Body() body: { slug: string; nome: string; tipoConta: 'infoprodutor' | 'corporativo'; valorBase: number; alunosIncluidos?: number | null; valorPorExcedente?: number | null; limiteUsuarios?: number | null }) {
    return this.billing.criarCatalogo(body as never);
  }

  @Patch('admin/planos-catalogo/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  atualizarCatalogo(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.billing.atualizarCatalogo(id, body);
  }

  @Delete('admin/planos-catalogo/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  removerCatalogo(@Param('id') id: string) {
    return this.billing.removerCatalogo(id);
  }

  // Aplica um plano do catálogo a uma conta
  @Post('admin/contas/:id/aplicar-plano')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  aplicarPlano(@Param('id') id: string, @Body('planoCatalogoId') planoCatalogoId: string) {
    return this.billing.aplicarPlano(id, planoCatalogoId);
  }

  // Trial manual por conta (dias)
  @Post('admin/contas/:id/trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  definirTrial(@Param('id') id: string, @Body('dias') dias: number) {
    return this.billing.definirTrial(id, Number(dias));
  }

  // ===== Cupons (Super Admin) =====
  @Get('admin/cupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  listarCupons() {
    return this.billing.listarCupons();
  }

  @Post('admin/cupons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  criarCupom(@Body() body: { codigo: string; tipo: 'percentual' | 'fixo'; valor: number; descricao?: string; tipoConta?: TipoConta | null; duracaoMeses?: number | null; maxUsos?: number | null; validoAte?: string | null }) {
    return this.billing.criarCupom(body);
  }

  @Patch('admin/cupons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  atualizarCupom(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.billing.atualizarCupom(id, body);
  }

  @Delete('admin/cupons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.super_admin)
  removerCupom(@Param('id') id: string) {
    return this.billing.removerCupom(id);
  }

  // ===== Autoatendimento (público) =====
  @Get('public/planos-catalogo')
  catalogoPublico() {
    return this.billing.catalogoPublico();
  }

  @Post('public/validar-cupom')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  validarCupom(@Body() body: { codigo: string; tipoConta?: TipoConta | null }) {
    return this.billing.validarCupom(body.codigo, body.tipoConta ?? null);
  }

  @Post('public/signup-produtor')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  signupProdutor(@Body() body: { marca: string; adminNome: string; adminEmail: string; senha: string; planoCatalogoId: string; cupom?: string; ref?: string; metodo?: 'pix' | 'boleto'; documento?: string; telefone?: string }) {
    return this.billing.signupProdutor(body);
  }

  // Produtor/Gestor: prévia da própria fatura do mês (acessível mesmo com painel bloqueado, p/ regularizar)
  @Get('painel/minha-fatura')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  @PermitirInadimplente()
  minhaFatura(@CurrentUser() u: AuthUser) {
    return this.billing.calcular(u.contaId!);
  }

  // Assinatura da própria conta (corporativo: pode configurar cartão recorrente)
  @Get('painel/assinatura')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  @PermitirInadimplente()
  minhaAssinatura(@CurrentUser() u: AuthUser) {
    return this.billing.minhaAssinatura(u.contaId!);
  }

  @Post('painel/assinatura/cartao')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  @PermitirInadimplente()
  assinarCartao(
    @CurrentUser() u: AuthUser,
    @Body() body: {
      paymentToken: string;
      customer: { nome: string; cpf: string; email: string; nascimento: string; telefone?: string };
      endereco?: { rua: string; numero: string; bairro: string; cep: string; cidade: string; estado: string; complemento?: string };
    },
  ) {
    return this.billing.assinarCartaoCorporativo(u.contaId!, body);
  }

  // Fatura em aberto (para a tela de regularização quando o painel está bloqueado)
  @Get('painel/minha-fatura-aberta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  @PermitirInadimplente()
  faturaAberta(@CurrentUser() u: AuthUser) {
    return this.billing.faturaAbertaDaConta(u.contaId!);
  }

  // Histórico de faturas da própria conta (Central de Assinatura)
  @Get('painel/minhas-faturas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin_tenant)
  @PermitirInadimplente()
  minhasFaturas(@CurrentUser() u: AuthUser) {
    return this.billing.minhasFaturas(u.contaId!);
  }

  // Validação do webhook: a Efí faz uma requisição na URL base ao registrar — precisa responder 2xx.
  @Get('webhooks/efi')
  @HttpCode(200)
  efiPing() {
    return { ok: true };
  }

  @Get('webhooks/efi/pix')
  @HttpCode(200)
  efiPingPix() {
    return { ok: true };
  }

  // Webhook da Efí: Pix (body.pix) ou Cobranças/boleto (body.notification = token). Público; autenticidade por mTLS/segredo.
  @Post('webhooks/efi')
  @HttpCode(200)
  efiWebhookBase(@Body() body: { pix?: Array<{ txid?: string }>; notification?: string }, @Query('hmac') hmac?: string) {
    if (!webhookEfiAutorizado(hmac)) return { ok: false };
    if (body?.notification) return this.billing.processarNotificacaoCobranca(body.notification);
    return this.billing.processarWebhookEfi(body);
  }

  @Post('webhooks/efi/pix')
  @HttpCode(200)
  efiWebhook(@Body() body: { pix?: Array<{ txid?: string }>; notification?: string }, @Query('hmac') hmac?: string) {
    if (!webhookEfiAutorizado(hmac)) return { ok: false };
    if (body?.notification) return this.billing.processarNotificacaoCobranca(body.notification);
    return this.billing.processarWebhookEfi(body);
  }

  // Cron mensal protegido por segredo
  @Post('internal/faturamento/fechar')
  @HttpCode(200)
  cron(@Headers('x-cron-secret') secret: string, @Body('competencia') competencia?: string) {
    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
      throw new ForbiddenException('Acesso negado');
    }
    return this.billing.fecharTodas(competencia || competenciaAtual());
  }
}
