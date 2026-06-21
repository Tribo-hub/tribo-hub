import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EfiService } from './efi.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, EfiService],
})
export class BillingModule {}
