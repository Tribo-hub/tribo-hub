import { Injectable, NotFoundException } from '@nestjs/common';
import { StatusAssinatura, StatusFatura, TipoCobranca, TipoConta } from '@tribohub/db';
import { env } from '@tribohub/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EfiService } from './efi.service';

export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DIA_MS = 86_400_000;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly efi: EfiService,
    private readonly email: EmailService,
  ) {}

  // Emite uma cobrança Pix (Efí) para a fatura informada.
  async cobrar(faturaId: string) {
    const fatura = await this.prisma.faturaPlataforma.findUnique({
      where: { id: faturaId },
      include: { conta: { select: { nome: true } } },
    });
    if (!fatura) throw new NotFoundException('Fatura não encontrada');
    const cob = await this.efi.criarCobrancaPix({
      valor: Number(fatura.valorTotal),
      descricao: `Tribo Hub - fatura ${fatura.competencia} - ${fatura.conta.nome}`,
    });
    await this.prisma.faturaPlataforma.update({
      where: { id: faturaId },
      data: { txid: cob.txid, pixCopiaECola: cob.pixCopiaECola },
    });
    return cob;
  }

  // Confirma pagamento de uma fatura a partir do txid (usado pelo webhook da Efí).
  async confirmarPagamentoPorTxid(txid: string) {
    if (!txid) return { ok: false, motivo: 'txid ausente' };
    const fatura = await this.prisma.faturaPlataforma.findFirst({ where: { txid } });
    if (!fatura) return { ok: false, motivo: 'fatura não encontrada' };
    if (fatura.status === 'paga') return { ok: true, jaPaga: true };
    await this.prisma.faturaPlataforma.update({
      where: { id: fatura.id },
      data: { status: 'paga', pagoEm: new Date() },
    });
    await this.reativarPorPagamento(fatura.contaId);
    return { ok: true, faturaId: fatura.id };
  }

  // Processa a notificação Pix da Efí: { pix: [{ txid, ... }] }.
  async processarWebhookEfi(body: { pix?: Array<{ txid?: string }> }) {
    const itens = Array.isArray(body?.pix) ? body.pix : [];
    const resultados = [];
    for (const p of itens) {
      if (p?.txid) resultados.push(await this.confirmarPagamentoPorTxid(p.txid));
    }
    return { ok: true, processados: resultados.length };
  }

  // Marca uma fatura como paga (registro manual pelo super admin).
  async marcarPaga(faturaId: string) {
    const fatura = await this.prisma.faturaPlataforma.findUnique({ where: { id: faturaId } });
    if (!fatura) throw new NotFoundException('Fatura não encontrada');
    const atualizada = await this.prisma.faturaPlataforma.update({
      where: { id: faturaId },
      data: { status: 'paga', pagoEm: new Date() },
    });
    await this.reativarPorPagamento(fatura.contaId);
    return atualizada;
  }

  // Pagamento confirmado: limpa os marcadores de inadimplência e libera a conta.
  async reativarPorPagamento(contaId: string) {
    await this.prisma.assinaturaPlataforma.updateMany({
      where: { contaId, status: { not: StatusAssinatura.cancelada } },
      data: {
        status: StatusAssinatura.ativa,
        inadimplenteDesde: null,
        ultimoEstadoBilling: null,
        ultimoEstadoBillingEm: null,
        painelBloqueado: false,
        alunosBloqueados: false,
      },
    });
  }

  // Calcula (sem salvar) a fatura de uma conta para a competência.
  async calcular(contaId: string) {
    const conta = await this.prisma.conta.findUnique({
      where: { id: contaId },
      include: { assinatura: true },
    });
    if (!conta || !conta.assinatura) throw new NotFoundException('Conta/assinatura não encontrada');
    const ass = conta.assinatura;
    const valorBase = Number(ass.valorBase);

    let tipo: 'infoprodutor' | 'corporativo';
    let alunosAtivos: number | null = null;
    let assentosUsados: number | null = null;
    let valorExcedente = 0;

    if (conta.tipoConta === TipoConta.infoprodutor) {
      tipo = 'infoprodutor';
      const ativosRaw = await this.prisma.matricula.findMany({
        where: { contaId, status: 'ativa', OR: [{ expiraEm: null }, { expiraEm: { gte: new Date() } }] },
        select: { usuarioId: true },
      });
      alunosAtivos = new Set(ativosRaw.map((m) => m.usuarioId)).size;
      const incluidos = ass.alunosIncluidos ?? 0;
      const excedentes = Math.max(0, alunosAtivos - incluidos);
      valorExcedente = excedentes * Number(ass.valorPorExcedente ?? 0);
    } else {
      tipo = 'corporativo';
      assentosUsados = await this.prisma.usuario.count({ where: { contaId, role: 'aluno', ativo: true } });
    }

    const bruto = valorBase + valorExcedente;
    const descontoValor = this.descontoVigente(ass, bruto);
    const valorTotal = Math.max(0, bruto - descontoValor);
    return { tipo, alunosAtivos, assentosUsados, valorBase, valorExcedente, descontoValor, valorTotal };
  }

  // Desconto vigente da assinatura (percentual/fixo, respeitando a vigência).
  private descontoVigente(ass: { descontoTipo: string | null; descontoValor: unknown; descontoAte: Date | null }, bruto: number): number {
    if (!ass.descontoValor) return 0;
    if (ass.descontoAte && ass.descontoAte.getTime() < Date.now()) return 0;
    const v = Number(ass.descontoValor);
    if (v <= 0) return 0;
    const desc = ass.descontoTipo === 'percentual' ? (bruto * v) / 100 : v;
    return Math.min(bruto, Math.round(desc * 100) / 100);
  }

  // Calcula e grava a fatura (idempotente por conta+competência).
  async fecharFatura(contaId: string, competencia: string) {
    const existente = await this.prisma.faturaPlataforma.findUnique({
      where: { contaId_competencia: { contaId, competencia } },
    });
    if (existente?.status === 'paga') return existente; // não recalcula fatura já paga
    const c = await this.calcular(contaId);
    return this.prisma.faturaPlataforma.upsert({
      where: { contaId_competencia: { contaId, competencia } },
      create: {
        contaId,
        competencia,
        alunosAtivos: c.alunosAtivos,
        assentosUsados: c.assentosUsados,
        valorBase: c.valorBase,
        valorExcedente: c.valorExcedente,
        descontoValor: c.descontoValor,
        valorTotal: c.valorTotal,
        fechadaEm: new Date(),
      },
      update: {
        alunosAtivos: c.alunosAtivos,
        assentosUsados: c.assentosUsados,
        valorBase: c.valorBase,
        valorExcedente: c.valorExcedente,
        descontoValor: c.descontoValor,
        valorTotal: c.valorTotal,
        fechadaEm: new Date(),
      },
    });
  }

  // Fecha a fatura de todas as contas ativas com assinatura.
  async fecharTodas(competencia: string) {
    const contas = await this.prisma.conta.findMany({
      where: { ativo: true, assinatura: { isNot: null } },
      select: { id: true },
    });
    const faturas = [];
    for (const c of contas) {
      faturas.push(await this.fecharFatura(c.id, competencia));
    }
    return { competencia, quantidade: faturas.length };
  }

  async listar(competencia: string) {
    const faturas = await this.prisma.faturaPlataforma.findMany({
      where: { competencia },
      include: { conta: { select: { nome: true, tipoConta: true } } },
      orderBy: { valorTotal: 'desc' },
    });
    const mrr = faturas.reduce((s, f) => s + Number(f.valorTotal), 0);
    return { competencia, mrr, totalContas: faturas.length, faturas };
  }

  // ===== Dashboard financeiro (Super Admin) =====
  async dashboard(competencia: string) {
    const somaPagas = async (comp: string) => {
      const fs = await this.prisma.faturaPlataforma.findMany({ where: { competencia: comp, status: StatusFatura.paga }, select: { valorTotal: true } });
      return fs.reduce((s, f) => s + Number(f.valorTotal), 0);
    };
    const mrr = await somaPagas(competencia);

    const [ativas, inadimplentes, canceladas, faturasVencidas] = await Promise.all([
      this.prisma.assinaturaPlataforma.count({ where: { status: StatusAssinatura.ativa } }),
      this.prisma.assinaturaPlataforma.count({ where: { status: { in: [StatusAssinatura.inadimplente, StatusAssinatura.suspensa] } } }),
      this.prisma.assinaturaPlataforma.count({ where: { status: StatusAssinatura.cancelada } }),
      this.prisma.faturaPlataforma.count({ where: { competencia, status: StatusFatura.vencida } }),
    ]);

    const ticketMedio = ativas > 0 ? mrr / ativas : 0;
    const churn = ativas + canceladas > 0 ? (canceladas / (ativas + canceladas)) * 100 : 0;

    // MRR dos últimos 6 meses (inclui a competência atual)
    const [ay, am] = competencia.split('-').map(Number);
    const historico: { competencia: string; mrr: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(ay, am - 1 - i, 1));
      const comp = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      historico.push({ competencia: comp, mrr: await somaPagas(comp) });
    }

    return {
      competencia,
      mrr,
      arr: mrr * 12,
      ticketMedio,
      churn,
      contasAtivas: ativas,
      inadimplentes,
      canceladas,
      faturasVencidas,
      historicoMrr: historico,
    };
  }

  // ===== Cobrança avulsa (fora do ciclo) =====
  async cobrancaAvulsa(contaId: string, valor: number, observacao?: string) {
    if (!valor || valor <= 0) throw new NotFoundException('Valor inválido');
    const venc = new Date(Date.now() + env.BILLING_DIAS_VENCIMENTO * DIA_MS);
    const fatura = await this.prisma.faturaPlataforma.create({
      data: {
        contaId,
        competencia: `${competenciaAtual()}#avulsa-${Date.now()}`,
        valorBase: valor,
        valorExcedente: 0,
        valorTotal: valor,
        avulsa: true,
        observacao: observacao ?? null,
        vencimentoEm: venc,
        metodoPagamento: 'pix',
        fechadaEm: new Date(),
      },
    });
    let pix: Awaited<ReturnType<BillingService['cobrar']>> | null = null;
    try { pix = await this.cobrar(fatura.id); } catch { /* Efí indisponível */ }
    return { faturaId: fatura.id, valor, pix };
  }

  // ===== Desconto por conta =====
  async definirDesconto(contaId: string, dto: { tipo: 'percentual' | 'fixo'; valor: number; ate?: string | null; motivo?: string }) {
    return this.prisma.assinaturaPlataforma.update({
      where: { contaId },
      data: {
        descontoTipo: dto.tipo,
        descontoValor: dto.valor,
        descontoAte: dto.ate ? new Date(dto.ate) : null,
        descontoMotivo: dto.motivo ?? null,
      },
    });
  }

  async removerDesconto(contaId: string) {
    return this.prisma.assinaturaPlataforma.update({
      where: { contaId },
      data: { descontoTipo: null, descontoValor: null, descontoAte: null, descontoMotivo: null },
    });
  }

  // ===== Notas internas por conta =====
  async listarNotas(contaId: string) {
    return this.prisma.notaConta.findMany({ where: { contaId }, orderBy: { createdAt: 'desc' } });
  }
  async adicionarNota(contaId: string, autorId: string, texto: string) {
    return this.prisma.notaConta.create({ data: { contaId, autorId, texto } });
  }
  async removerNota(id: string) {
    await this.prisma.notaConta.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ===== Catálogo de planos (Fase 3) =====
  async listarCatalogo() {
    return this.prisma.planoCatalogo.findMany({ orderBy: [{ ativo: 'desc' }, { valorBase: 'asc' }] });
  }
  async criarCatalogo(dto: {
    slug: string; nome: string; tipoConta: TipoConta; valorBase: number;
    alunosIncluidos?: number | null; valorPorExcedente?: number | null; limiteUsuarios?: number | null;
  }) {
    return this.prisma.planoCatalogo.create({
      data: {
        slug: dto.slug, nome: dto.nome, tipoConta: dto.tipoConta, valorBase: dto.valorBase,
        alunosIncluidos: dto.alunosIncluidos ?? null,
        valorPorExcedente: dto.valorPorExcedente ?? null,
        limiteUsuarios: dto.limiteUsuarios ?? null,
      },
    });
  }
  async atualizarCatalogo(id: string, dto: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const k of ['slug', 'nome', 'tipoConta', 'valorBase', 'alunosIncluidos', 'valorPorExcedente', 'limiteUsuarios', 'ativo'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    return this.prisma.planoCatalogo.update({ where: { id }, data });
  }
  async removerCatalogo(id: string) {
    return this.prisma.planoCatalogo.update({ where: { id }, data: { ativo: false } });
  }

  // Aplica um plano do catálogo à assinatura de uma conta (copia os valores).
  async aplicarPlano(contaId: string, planoCatalogoId: string) {
    const p = await this.prisma.planoCatalogo.findUnique({ where: { id: planoCatalogoId } });
    if (!p) throw new NotFoundException('Plano não encontrado');
    return this.prisma.assinaturaPlataforma.update({
      where: { contaId },
      data: {
        planoCatalogoId: p.id,
        plano: p.nome,
        tipoCobranca: p.tipoConta === TipoConta.infoprodutor ? TipoCobranca.alunos_ativos : TipoCobranca.assentos,
        valorBase: p.valorBase,
        alunosIncluidos: p.alunosIncluidos ?? null,
        valorPorExcedente: p.valorPorExcedente ?? null,
        limiteUsuarios: p.limiteUsuarios ?? null,
      },
    });
  }

  // Trial manual: define quantos dias de cortesia (0/null remove o trial).
  async definirTrial(contaId: string, dias: number | null) {
    const trialAte = dias && dias > 0 ? new Date(Date.now() + dias * DIA_MS) : null;
    return this.prisma.assinaturaPlataforma.update({ where: { contaId }, data: { trialAte } });
  }

  // Fatura em aberto (pendente/vencida) da conta — usada na tela de "regularize" do produtor.
  async faturaAbertaDaConta(contaId: string) {
    return this.prisma.faturaPlataforma.findFirst({
      where: { contaId, status: { in: [StatusFatura.pendente, StatusFatura.vencida] } },
      orderBy: { fechadaEm: 'desc' },
      select: { id: true, competencia: true, valorTotal: true, status: true, vencimentoEm: true, pixCopiaECola: true },
    });
  }

  // ===== Ciclo de vida da fatura (máquina de estados diária, idempotente) =====
  async processarCicloVida(hoje: Date = new Date()) {
    const VENC = env.BILLING_DIAS_VENCIMENTO;
    const PAINEL = env.BILLING_SUSPENSAO_PAINEL_DIAS;
    const ALUNOS = env.BILLING_SUSPENSAO_ALUNOS_DIAS;
    const reais = (v: unknown) => `R$ ${Number(v).toFixed(2)}`;

    const faturas = await this.prisma.faturaPlataforma.findMany({
      where: { status: { in: [StatusFatura.pendente, StatusFatura.vencida] } },
      include: { conta: { select: { id: true, assinatura: true } } },
      orderBy: { fechadaEm: 'asc' },
    });

    let processadas = 0;
    for (const f of faturas) {
      const ass = f.conta.assinatura;
      if (!ass || ass.status === StatusAssinatura.cancelada) continue;
      // Em período de trial: não cobra, não avisa, não suspende.
      if (ass.trialAte && ass.trialAte.getTime() > hoje.getTime()) continue;

      // 1) Fatura recém-fechada: emite a cobrança Pix, define o vencimento e avisa.
      if (!f.vencimentoEm) {
        const venc = new Date(f.fechadaEm.getTime() + VENC * DIA_MS);
        if (Number(f.valorTotal) > 0 && !f.txid) {
          try { await this.cobrar(f.id); } catch { /* Efí indisponível: tenta no próximo ciclo */ }
        }
        await this.prisma.faturaPlataforma.update({
          where: { id: f.id },
          data: { vencimentoEm: venc, metodoPagamento: f.metodoPagamento ?? 'pix' },
        });
        await this.avisar(f.conta.id, 'Sua fatura está disponível',
          `<p>A fatura de <b>${f.competencia}</b> no valor de <b>${reais(f.valorTotal)}</b> está disponível. Vence em ${venc.toLocaleDateString('pt-BR')}.</p>`);
        await this.marcarEstado(ass.id, 'emitida', hoje);
        processadas++;
        continue;
      }

      const diasParaVencer = Math.ceil((f.vencimentoEm.getTime() - hoje.getTime()) / DIA_MS);

      // 2) Avisos antes de vencer (D-3 / D-1)
      if (f.status === StatusFatura.pendente && diasParaVencer <= 3 && diasParaVencer >= 0) {
        const marcador = diasParaVencer <= 1 ? 'aviso_d1' : 'aviso_d3';
        if (ass.ultimoEstadoBilling !== marcador && ass.ultimoEstadoBilling !== 'aviso_d1') {
          await this.avisar(f.conta.id, 'Sua fatura vence em breve',
            `<p>A fatura de <b>${f.competencia}</b> (${reais(f.valorTotal)}) vence em ${f.vencimentoEm.toLocaleDateString('pt-BR')}.</p>`);
          await this.marcarEstado(ass.id, marcador, hoje);
          processadas++;
        }
        continue;
      }

      // 3) Vencida → inadimplente → (15d) painel → (30d) alunos
      if (diasParaVencer < 0) {
        if (f.status !== StatusFatura.vencida) {
          await this.prisma.faturaPlataforma.update({ where: { id: f.id }, data: { status: StatusFatura.vencida } });
        }
        const marcou = await this.prisma.assinaturaPlataforma.updateMany({
          where: { id: ass.id, inadimplenteDesde: null },
          data: { status: StatusAssinatura.inadimplente, inadimplenteDesde: hoje },
        });
        if (marcou.count > 0) {
          await this.avisar(f.conta.id, 'Pagamento em atraso',
            `<p>A fatura de <b>${f.competencia}</b> está em atraso. Regularize para manter o seu acesso.</p>`);
        }
        const ancora = ass.inadimplenteDesde ?? hoje;
        const atraso = Math.floor((hoje.getTime() - ancora.getTime()) / DIA_MS);

        if (atraso >= PAINEL && !ass.painelBloqueado) {
          const r = await this.prisma.assinaturaPlataforma.updateMany({
            where: { id: ass.id, painelBloqueado: false },
            data: { painelBloqueado: true, status: StatusAssinatura.suspensa },
          });
          if (r.count > 0) {
            await this.avisar(f.conta.id, 'Painel bloqueado por inadimplência',
              `<p>Após ${PAINEL} dias de atraso, o seu painel foi bloqueado. Regularize a fatura para reativar.</p>`);
          }
        }
        if (atraso >= ALUNOS && !ass.alunosBloqueados) {
          const r = await this.prisma.assinaturaPlataforma.updateMany({
            where: { id: ass.id, alunosBloqueados: false },
            data: { alunosBloqueados: true },
          });
          if (r.count > 0) {
            await this.avisar(f.conta.id, 'Acesso dos alunos suspenso',
              `<p>Após ${ALUNOS} dias de atraso, o acesso dos seus alunos foi suspenso. Regularize para reativar.</p>`);
          }
        }
        processadas++;
      }
    }
    return { processadas };
  }

  private async marcarEstado(assinaturaId: string, estado: string, hoje: Date) {
    await this.prisma.assinaturaPlataforma.update({
      where: { id: assinaturaId },
      data: { ultimoEstadoBilling: estado, ultimoEstadoBillingEm: hoje },
    });
  }

  // Envia aviso ao admin da conta (fire-and-forget: nunca quebra o ciclo).
  private async avisar(contaId: string, titulo: string, corpo: string) {
    try {
      const admin = await this.prisma.usuario.findFirst({
        where: { contaId, role: 'admin_tenant', ativo: true },
        select: { email: true },
      });
      if (admin?.email) await this.email.cobranca(admin.email, titulo, corpo);
    } catch {
      /* fire-and-forget */
    }
  }
}
