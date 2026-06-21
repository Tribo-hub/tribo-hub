import { ConteudoService } from './conteudo.service';

const superAdmin = { sub: 's1', role: 'super_admin', contaId: null } as any;
const gestorA = { sub: 'a1', role: 'admin_tenant', contaId: 'A' } as any;

describe('ConteudoService — propriedade e isolamento', () => {
  it('super_admin cria conteúdo de PLATAFORMA (contaId null)', async () => {
    const prisma = { trilha: { create: jest.fn().mockImplementation(({ data }) => data) } } as any;
    const r = await new ConteudoService(prisma).criarTrilha(superAdmin, { titulo: 't', descricao: 'd' } as any);
    expect(r.proprietarioTipo).toBe('plataforma');
    expect(r.contaId).toBeNull();
  });

  it('admin_tenant cria conteúdo do TENANT (isolado por conta)', async () => {
    const prisma = { trilha: { create: jest.fn().mockImplementation(({ data }) => data) } } as any;
    const r = await new ConteudoService(prisma).criarTrilha(gestorA, { titulo: 't', descricao: 'd' } as any);
    expect(r.proprietarioTipo).toBe('tenant');
    expect(r.contaId).toBe('A');
  });

  it('tenant NÃO acessa trilha de outra conta (403)', async () => {
    const prisma = {
      trilha: {
        findFirst: jest.fn().mockResolvedValue({ id: 't1', proprietarioTipo: 'tenant', contaId: 'B' }),
        update: jest.fn(),
      },
    } as any;
    await expect(
      new ConteudoService(prisma).atualizarTrilha(gestorA, 't1', { titulo: 'x' } as any),
    ).rejects.toThrow();
    expect(prisma.trilha.update).not.toHaveBeenCalled();
  });

  it('tenant acessa a PRÓPRIA trilha', async () => {
    const prisma = {
      trilha: {
        findFirst: jest.fn().mockResolvedValue({ id: 't1', proprietarioTipo: 'tenant', contaId: 'A' }),
        update: jest.fn().mockResolvedValue({ id: 't1' }),
      },
    } as any;
    await new ConteudoService(prisma).atualizarTrilha(gestorA, 't1', { titulo: 'x' } as any);
    expect(prisma.trilha.update).toHaveBeenCalled();
  });
});
