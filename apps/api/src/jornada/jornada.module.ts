import { Module } from '@nestjs/common';
import { GamificacaoModule } from '../gamificacao/gamificacao.module';
import { PlanosModule } from '../planos/planos.module';
import { JornadaController } from './jornada.controller';
import { JornadaService } from './jornada.service';

@Module({
  imports: [PlanosModule, GamificacaoModule],
  controllers: [JornadaController],
  providers: [JornadaService],
})
export class JornadaModule {}
