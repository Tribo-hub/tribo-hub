import { Module } from '@nestjs/common';
import {
  AgentesAdminController,
  AgentesAppController,
  AgentesPainelController,
} from './agentes.controller';
import { AgentesService } from './agentes.service';

@Module({
  controllers: [AgentesAdminController, AgentesPainelController, AgentesAppController],
  providers: [AgentesService],
})
export class AgentesModule {}
