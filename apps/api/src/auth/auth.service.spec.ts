import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const jwt = {
  signAsync: jest.fn().mockResolvedValue('tok'),
  verifyAsync: jest.fn(),
} as any;

function mkPrisma(user: any) {
  return {
    usuario: {
      findFirst: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({}),
    },
    conta: { findUnique: jest.fn() },
  } as any;
}

describe('AuthService.login', () => {
  beforeEach(() => jwt.signAsync.mockClear());

  it('retorna tokens com senha correta', async () => {
    const user = {
      id: 'u1',
      senhaHash: bcrypt.hashSync('senha123', 4),
      ativo: true,
      bloqueadoAte: null,
      tentativasFalhas: 0,
      role: 'aluno',
      contaId: 'c1',
      nome: 'X',
      email: 'x@x.com',
    };
    const prisma = mkPrisma(user);
    const res = await new AuthService(prisma, jwt).login('x@x.com', 'senha123', null);
    expect(res.accessToken).toBe('tok');
    expect(res.usuario.id).toBe('u1');
  });

  it('senha errada incrementa tentativas e lança', async () => {
    const user = {
      id: 'u1',
      senhaHash: bcrypt.hashSync('correta', 4),
      ativo: true,
      bloqueadoAte: null,
      tentativasFalhas: 0,
      role: 'aluno',
      contaId: null,
    };
    const prisma = mkPrisma(user);
    await expect(new AuthService(prisma, jwt).login('x', 'errada', null)).rejects.toThrow();
    expect(prisma.usuario.update).toHaveBeenCalled();
  });

  it('5ª falha bloqueia a conta', async () => {
    const user = {
      id: 'u1',
      senhaHash: bcrypt.hashSync('correta', 4),
      ativo: true,
      bloqueadoAte: null,
      tentativasFalhas: 4,
      role: 'aluno',
      contaId: null,
    };
    const prisma = mkPrisma(user);
    await expect(new AuthService(prisma, jwt).login('x', 'errada', null)).rejects.toThrow();
    expect(prisma.usuario.update.mock.calls[0][0].data.bloqueadoAte).toBeDefined();
  });

  it('usuário inativo é barrado', async () => {
    const user = {
      id: 'u1',
      senhaHash: bcrypt.hashSync('senha123', 4),
      ativo: false,
      bloqueadoAte: null,
      tentativasFalhas: 0,
      role: 'aluno',
      contaId: null,
    };
    const prisma = mkPrisma(user);
    await expect(new AuthService(prisma, jwt).login('x', 'senha123', null)).rejects.toThrow();
  });
});
