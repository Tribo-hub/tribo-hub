import { CorporativoService } from './corporativo.service';

const email = { convite: jest.fn().mockResolvedValue({}) } as any;

describe('CorporativoService.convidar — limite de assentos', () => {
  it('bloqueia convite acima do limite do plano', async () => {
    const prisma = {
      assinaturaPlataforma: { findUnique: jest.fn().mockResolvedValue({ limiteUsuarios: 1 }) },
      usuario: { count: jest.fn().mockResolvedValue(1), findFirst: jest.fn(), create: jest.fn() },
      inviteToken: { create: jest.fn() },
      conta: { findUnique: jest.fn().mockResolvedValue({ nome: 'X' }) },
    } as any;
    await expect(new CorporativoService(prisma, email).convidar('A', 'Novo', 'novo@x.com')).rejects.toThrow();
    expect(prisma.usuario.create).not.toHaveBeenCalled();
    expect(prisma.inviteToken.create).not.toHaveBeenCalled();
  });

  it('permite convite dentro do limite e gera token', async () => {
    const prisma = {
      assinaturaPlataforma: { findUnique: jest.fn().mockResolvedValue({ limiteUsuarios: 10 }) },
      usuario: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1', nome: 'Novo' }),
      },
      inviteToken: { create: jest.fn().mockResolvedValue({}) },
      conta: { findUnique: jest.fn().mockResolvedValue({ nome: 'X' }) },
    } as any;
    const r = await new CorporativoService(prisma, email).convidar('A', 'Novo', 'novo@x.com');
    expect(r.conviteToken).toBeDefined();
    expect(prisma.inviteToken.create).toHaveBeenCalled();
  });
});
