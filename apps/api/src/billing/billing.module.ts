import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EfiService } from './efi.service';
import { ParceirosController } from './parceiros.controller';
import { ParceirosService } from './parceiros.service';

@Module({
  controllers: [BillingController, ParceirosController],
  providers: [BillingService, EfiService, ParceirosService],
})
export class BillingModule {}
