import { Module } from '@nestjs/common';
import { AgendaAppController, AgendaPainelController } from './agenda.controller';
import { AgendaService } from './agenda.service';

@Module({
  controllers: [AgendaPainelController, AgendaAppController],
  providers: [AgendaService],
})
export class AgendaModule {}
