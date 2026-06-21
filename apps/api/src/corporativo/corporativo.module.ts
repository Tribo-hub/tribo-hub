import { Module } from '@nestjs/common';
import { CorporativoController } from './corporativo.controller';
import { CorporativoService } from './corporativo.service';

@Module({
  controllers: [CorporativoController],
  providers: [CorporativoService],
})
export class CorporativoModule {}
