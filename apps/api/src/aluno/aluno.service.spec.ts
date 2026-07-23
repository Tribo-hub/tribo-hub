import { AlunoService } from './aluno.service';

const alunoInfo = { sub: 'u1', role: 'aluno', contaId: 'A' } as any;

function svc(prisma: any) {
  return new AlunoService(prisma, {} as any, { registrar: jest.fn() } as any);
}

describe('AlunoService — isolamento de acesso', () => {
  it('infoprodutor: lista só trilhas com matrícula ativa da PRÓPRIA conta', async () => {
    let whereCapturado: any;
    const prisma = {
      conta: { findUnique: jest.fn().mockResolvedValue({ id: 'A', ativo: true, tipoConta: 'infoprodutor' }) },
      matricula: { findMany: jest.fn().mockResolvedValue([{ trilhaId: 't1' }, { trilhaId: 't2' }]) },
      trilha: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          whereCapturado = where;
          return [];
        }),
      },
    } as any;

    await svc(prisma).listarTrilhas(alunoInfo);

    expect(whereCapturado.contaId).toBe('A');
    expect(whereCapturado.proprietarioTipo).toBe('tenant');
    expect(whereCapturado.id.in).toEqual(['t1', 't2']);
    // só consultou matrículas da própria conta
    expect(prisma.matricula.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contaId: 'A', usuarioId: 'u1' }) }),
    );
  });

  it('conta inativa é barrada', async () => {
    const prisma = {
      conta: { findUnique: jest.fn().mockResolvedValue({ id: 'A', ativo: false, tipoConta: 'infoprodutor' }) },
    } as any;
    await expect(svc(prisma).listarTrilhas(alunoInfo)).rejects.toThrow();
  });
});
