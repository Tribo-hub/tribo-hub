import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const email = (process.env.SEED_ADMIN_EMAIL || 'superadmin@tribohub.com.br').toLowerCase();
const senha = process.env.SEED_ADMIN_PASSWORD || 'TriboAdmin@2026';

const existente = await prisma.usuario.findFirst({ where: { email, contaId: null } });

if (existente) {
  console.log('✓ Super admin já existe:', email);
} else {
  const senhaHash = await bcrypt.hash(senha, 12);
  await prisma.usuario.create({
    data: {
      nome: 'Super Admin',
      email,
      senhaHash,
      role: 'super_admin',
      contaId: null,
    },
  });
  console.log('✓ Super admin criado:', email);
  console.log('  senha:', senha, '(troque após o primeiro login)');
}

await prisma.$disconnect();
