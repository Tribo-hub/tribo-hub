import { BillingService } from './billing.service';

describe('BillingService.calcular', () => {
  it('infoprodutor: base + excedente por aluno ativo (dedupe)', async () => {
    const prisma = {
      conta: {
        findUnique: jest.fn().mockResolvedValue({
          tipoConta: 'infoprodutor',
          assinatura: { valorBase: 297, alunosIncluidos: 2, valorPorExcedente: 0.9 },
        }),
      },
      // a aparece 2x -> distintos: a,b,c,d = 4 ativos
      matricula: {
        findMany: jest.fn().mockResolvedValue([
          { usuarioId: 'a' }, { usuarioId: 'a' }, { usuarioId: 'b' }, { usuarioId: 'c' }, { usuarioId: 'd' },
        ]),
      },
    } as any;
    const r = await new BillingService(prisma).calcular('c1');
    expect(r.alunosAtivos).toBe(4);
    expect(r.valorExcedente).toBeCloseTo(1.8); // (4-2)*0.9
    expect(r.valorTotal).toBeCloseTo(298.8);
  });

  it('corporativo: cobra o valor base do plano (assentos usados)', async () => {
    const prisma = {
      conta: {
        findUnique: jest.fn().mockResolvedValue({ tipoConta: 'corporativo', assinatura: { valorBase: 199 } }),
      },
      usuario: { count: jest.fn().mockResolvedValue(12) },
    } as any;
    const r = await new BillingService(prisma).calcular('c1');
    expect(r.assentosUsados).toBe(12);
    expect(r.valorExcedente).toBe(0);
    expect(r.valorTotal).toBe(199);
  });
});
