import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BillingService, competenciaAtual } from './billing/billing.service';
import { captureError, initSentry } from './common/observability';
import { InfoprodutorService } from './infoprodutor/infoprodutor.service';

/**
 * Entrypoint dos jobs agendados (serviço de cron no Railway).
 * Uso: `node apps/api/dist/cron.js <job>` onde job = daily | expirar | fechar.
 * - expirar: marca matrículas vencidas como expiradas (sai da contagem de cobrança).
 * - fechar : fecha as faturas do mês de todas as contas ativas.
 * - daily  : roda a expiração todo dia e o fechamento apenas no dia 1.
 */
async function run() {
  const log = new Logger('Cron');
  initSentry();
  const job = process.argv[2] ?? 'daily';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    if (job === 'expirar' || job === 'daily') {
      const r = await app.get(InfoprodutorService, { strict: false }).expirarMatriculas();
      log.log(`Expiração concluída: ${r.expiradas} matrícula(s) expirada(s).`);
    }

    const ehDiaDeFechar = new Date().getUTCDate() === 1;
    if (job === 'fechar' || (job === 'daily' && ehDiaDeFechar)) {
      const comp = competenciaAtual();
      const r = await app.get(BillingService, { strict: false }).fecharTodas(comp);
      log.log(`Fechamento ${comp} concluído: ${r.quantidade} fatura(s).`);
    }

    // Ciclo de vida da fatura: emite cobrança ao fechar, avisa, marca atraso e bloqueia (15/30 dias).
    if (job === 'ciclo' || job === 'daily') {
      const r = await app.get(BillingService, { strict: false }).processarCicloVida(new Date());
      log.log(`Ciclo de vida processado: ${r.processadas} fatura(s) tocada(s).`);
    }

    await app.close();
    process.exit(0);
  } catch (e) {
    log.error(`Cron "${job}" falhou: ${(e as Error).message}`);
    captureError(e, { job });
    await app.close();
    process.exit(1);
  }
}

void run();
