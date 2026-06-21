import { WebhookService } from './webhook.service';

const conta = { ativo: true, tipoConta: 'infoprodutor' };
const integ = { ativo: true, webhookSecret: 'segredo' };
const payload = {
  event: 'PURCHASE_APPROVED',
  data: {
    buyer: { email: 'm@x.com', name: 'M' },
    product: { id: '4471' },
    purchase: { transaction: 'HP1', price: { value: 497 } },
  },
};

function mkPrisma(over: any = {}) {
  return {
    conta: { findUnique: jest.fn().mockResolvedValue(conta) },
    integracao: { findUnique: jest.fn().mockResolvedValue(integ) },
    webhookEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'e1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    oferta: {
      findFirst: jest.fn().mockResolvedValue({ id: 'o1', trilhaId: 't1', tipoAcesso: 'prazo', duracaoAcessoDias: 365 }),
    },
    transacao: { upsert: jest.fn().mockResolvedValue({ id: 'tr1' }), updateMany: jest.fn() },
    usuario: { findFirst: jest.fn().mockResolvedValue({ id: 'u1' }) },
    matricula: { updateMany: jest.fn() },
    ...over,
  } as any;
}

const info = {
  encontrarOuCriarAluno: jest.fn().mockResolvedValue({ id: 'u1' }),
  upsertMatricula: jest.fn().mockResolvedValue({}),
} as any;

const email = { acessoLiberado: jest.fn().mockResolvedValue({}) } as any;

describe('WebhookService.hotmart', () => {
  beforeEach(() => {
    info.encontrarOuCriarAluno.mockClear();
    info.upsertMatricula.mockClear();
  });

  it('rejeita hottok inválido', async () => {
    await expect(new WebhookService(mkPrisma(), info, email).hotmart('c1', 'errado', payload)).rejects.toThrow();
  });

  it('evento duplicado retorna { duplicate: true }', async () => {
    const prisma = mkPrisma({
      webhookEvent: { findUnique: jest.fn().mockResolvedValue({ id: 'x' }), create: jest.fn(), update: jest.fn() },
    });
    const r = await new WebhookService(prisma, info, email).hotmart('c1', 'segredo', payload);
    expect(r).toEqual({ duplicate: true });
  });

  it('compra aprovada libera acesso (cria matrícula)', async () => {
    const r = await new WebhookService(mkPrisma(), info, email).hotmart('c1', 'segredo', payload);
    expect(r.resultado).toBe('acesso_liberado');
    expect(info.upsertMatricula).toHaveBeenCalled();
  });

  it('reembolso revoga acesso', async () => {
    const refund = { ...payload, event: 'PURCHASE_REFUNDED' };
    const prisma = mkPrisma();
    const r = await new WebhookService(prisma, info, email).hotmart('c1', 'segredo', refund);
    expect(r.resultado).toBe('acesso_revogado');
    expect(prisma.matricula.updateMany).toHaveBeenCalled();
  });
});
