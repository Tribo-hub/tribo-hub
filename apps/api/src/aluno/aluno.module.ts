import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AlunoController } from './aluno.controller';
import { AlunoService } from './aluno.service';
import { VerificacaoController } from './verificacao.controller';

@Module({
  imports: [StorageModule],
  controllers: [AlunoController, VerificacaoController],
  providers: [AlunoService],
})
export class AlunoModule {}
