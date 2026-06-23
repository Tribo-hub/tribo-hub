import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContasController } from './contas.controller';
import { ContasService } from './contas.service';
import { MenuLinksController } from './menu-links.controller';

@Module({
  imports: [AuthModule],
  controllers: [ContasController, MenuLinksController],
  providers: [ContasService],
})
export class ContasModule {}
