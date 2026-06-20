import { Module } from '@nestjs/common';
import { ConteudoController } from './conteudo.controller';
import { ConteudoService } from './conteudo.service';

@Module({
  controllers: [ConteudoController],
  providers: [ConteudoService],
})
export class ConteudoModule {}
