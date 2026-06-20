import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContasController } from './contas.controller';
import { ContasService } from './contas.service';

@Module({
  imports: [AuthModule],
  controllers: [ContasController],
  providers: [ContasService],
})
export class ContasModule {}
