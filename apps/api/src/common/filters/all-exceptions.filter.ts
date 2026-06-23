import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { captureError } from '../observability';

// Filtro global: loga erros 5xx com contexto e envia ao Sentry (se ativo).
// Respostas de HttpException são preservadas; erros não tratados viram 500 genérico.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const err = exception as Error;
      this.log.error(`${req?.method} ${req?.url} -> ${status}: ${err?.message}`, err?.stack);
      captureError(exception, {
        path: req?.url,
        method: req?.method,
        userId: req?.user?.sub,
        contaId: req?.user?.contaId,
      });
    }

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Erro interno' };
    res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
