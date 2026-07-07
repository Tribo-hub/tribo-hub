import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AgendaModule } from './agenda/agenda.module';
import { AgentesModule } from './agentes/agentes.module';
import { GamificacaoModule } from './gamificacao/gamificacao.module';
import { AlunoModule } from './aluno/aluno.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { SubscriptionStatusGuard } from './common/guards/subscription-status.guard';
import { EquipeGuard } from './common/guards/equipe.guard';
import { ContasModule } from './contas/contas.module';
import { ConteudoModule } from './conteudo/conteudo.module';
import { CorporativoModule } from './corporativo/corporativo.module';
import { EmailModule } from './email/email.module';
import { EquipeModule } from './equipe/equipe.module';
import { JornadaModule } from './jornada/jornada.module';
import { HealthController } from './health/health.controller';
import { InfoprodutorModule } from './infoprodutor/infoprodutor.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { PlanosModule } from './planos/planos.module';
import { StorageModule } from './storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EmailModule,
    PrismaModule,
    AuthModule,
    UsuariosModule,
    ContasModule,
    ConteudoModule,
    StorageModule,
    AlunoModule,
    InfoprodutorModule,
    CorporativoModule,
    BillingModule,
    NotificacoesModule,
    AgentesModule,
    AgendaModule,
    PlanosModule,
    GamificacaoModule,
    EquipeModule,
    JornadaModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SubscriptionStatusGuard },
    { provide: APP_GUARD, useClass: EquipeGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
