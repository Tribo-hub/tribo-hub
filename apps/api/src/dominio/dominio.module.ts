import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { DominioController } from './dominio.controller';
import { DominioService } from './dominio.service';

@Module({
  imports: [AuthModule, CloudflareModule],
  controllers: [DominioController],
  providers: [DominioService],
})
export class DominioModule {}
