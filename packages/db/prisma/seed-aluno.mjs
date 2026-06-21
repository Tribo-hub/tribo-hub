// Dados de teste para a Fase 3: cria um aluno na conta Academia do Trafego
// e publica a primeira trilha do tenant.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const conta = await prisma.conta.findFirst({ where: { slug: 'academia-do-trafego' } });
if (!conta) {
  console.log('Conta academia-do-trafego não encontrada.');
  process.exit(1);
}

const email = 'aluno@academiadotrafego.com.br';
const existe = await prisma.usuario.findFirst({ where: { email, contaId: conta.id } });
if (!existe) {
  await prisma.usuario.create({
    data: {
      contaId: conta.id,
      nome: 'Aluno Teste',
      email,
      senhaHash: await bcrypt.hash('Aluno@2026', 12),
      role: 'aluno',
    },
  });
  console.log('✓ Aluno criado:', email, '/ Aluno@2026');
} else {
  console.log('✓ Aluno já existe:', email);
}

const pub = await prisma.trilha.updateMany({
  where: { contaId: conta.id, proprietarioTipo: 'tenant', deletedAt: null },
  data: { publicado: true },
});
console.log('✓ Trilhas publicadas na conta:', pub.count);

await prisma.$disconnect();
