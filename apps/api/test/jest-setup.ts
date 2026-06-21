// Define variáveis de ambiente mínimas para o @tribohub/config validar nos testes
// (em CI não há .env; os testes mockam o Prisma, então os valores são fictícios).
process.env.DATABASE_URL ||= 'postgresql://test';
process.env.DIRECT_URL ||= 'postgresql://test';
process.env.JWT_ACCESS_SECRET ||= 'test-access';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh';
process.env.COOKIE_SECRET ||= 'test-cookie';
