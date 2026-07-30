import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RENTAL_LOOKUP } from './application/ports/rental-lookup.port';
import { RentalLookupAdapter } from './database/rental-lookup.adapter';
import { ListPaymentsHttpController } from './queries/list-payments/list-payments.http.controller';
import { ListPaymentsQueryHandler } from './queries/list-payments/list-payments.query-handler';

/**
 * First CODE in the payments context (schema existed since bootstrap).
 * Read-only so far: the write side still lives in the rentals return flow
 * (PaymentRecorderAdapter) until payments grows its own use cases.
 */
@Module({
  imports: [CqrsModule],
  controllers: [ListPaymentsHttpController],
  providers: [
    ListPaymentsQueryHandler,
    { provide: RENTAL_LOOKUP, useClass: RentalLookupAdapter },
  ],
})
export class PaymentsModule {}
