import { Logger } from '@nestjs/common';
import { env } from '@tribohub/config';

const log = new Logger('Observability');
let sentry: any = null;

// Inicializa o Sentry se houver DSN e o pacote estiver instalado (pnpm add @sentry/node).
// Mantido tolerante: sem DSN ou sem pacote, vira no-op (não derruba o boot).
export function initSentry() {
  if (!env.SENTRY_DSN) return;
  try {
    // require dinâmico: não cria dependência de build se o pacote não existir
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0 });
    sentry = Sentry;
    log.log('Sentry inicializado.');
  } catch {
    log.warn('SENTRY_DSN definido, mas @sentry/node não está instalado. Rode: pnpm --filter @tribohub/api add @sentry/node');
  }
}

export function captureError(err: unknown, contexto?: Record<string, unknown>) {
  if (!sentry) return;
  try {
    sentry.captureException(err, contexto ? { extra: contexto } : undefined);
  } catch {
    /* observabilidade nunca derruba a request */
  }
}
