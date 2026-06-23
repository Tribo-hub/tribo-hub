import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Carrega o .env da raiz do monorepo (fonte única de segredos)
config({ path: resolve(__dirname, '../../../.env') });

const schema = z.object({
  // App / geral
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_DOMAIN: z.string().default('tribohub.com.br'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3333'),

  // Banco (obrigatórios a partir da Fase 0)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL é obrigatório'),

  // Segredos da aplicação (obrigatórios a partir da Fase 1)
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(1),
  CRON_SECRET: z.string().optional(),
  INTERNAL_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(), // observabilidade (opcional; ativa o Sentry se presente)

  // Storage (Fase 2)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SERVICE_ROLE: z.string().optional(), // nome alternativo usado no .env
  ANON_PUBLIC: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('tribohub'),

  // E-mail (Fase 1)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Tribo Hub <no-reply@tribohub.com.br>'),

  // Integrações / cobrança (fases posteriores)
  HOTMART_WEBHOOK_SECRET: z.string().optional(),
  EFI_CLIENT_ID: z.string().optional(),
  EFI_CLIENT_SECRET: z.string().optional(),
  EFI_PIX_KEY: z.string().optional(),
  EFI_CERTIFICATE_PATH: z.string().optional(),
  EFI_CERTIFICATE_BASE64: z.string().optional(), // cert .p12 em base64 (produção/Railway)
  EFI_SANDBOX: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:\n', parsed.error.flatten().fieldErrors);
  throw new Error('Configuração de ambiente inválida — verifique o arquivo .env');
}

export const env = {
  ...parsed.data,
  // normaliza a chave service_role (pode estar como SUPABASE_SERVICE_ROLE_KEY ou SERVICE_ROLE)
  supabaseServiceRoleKey:
    parsed.data.SUPABASE_SERVICE_ROLE_KEY || parsed.data.SERVICE_ROLE,
};
export type Env = typeof env;
