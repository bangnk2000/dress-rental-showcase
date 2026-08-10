import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PAYMENT_REPOSITORY } from './application/ports/payment.repository.port';
import { RENTAL_LOOKUP } from './application/ports/rental-lookup.port';
import { RecordCollectionHttpController } from './commands/record-collection/record-collection.http.controller';
import { RecordCollectionService } from './commands/record-collection/record-collection.service';
import { PaymentMapper } from './database/payment.mapper';
import { PaymentRepository } from './database/payment.repository';
import { RentalLookupAdapter } from './database/rental-lookup.adapter';
import { ListPaymentsHttpController } from './queries/list-payments/list-payments.http.controller';
import { ListPaymentsQueryHandler } from './queries/list-payments/list-payments.query-handler';
import './payments.policies';

/**
 * Owns the money movements of a rental. The context now has its own aggregate + command for money
 * COLLECTED (FR-PAY-02); the three SETTLEMENT kinds are still written by the rentals return flow
 * (PaymentRecorderAdapter), because settling is a step of returning, not a use case of its own.
 */
@Module({
  imports: [CqrsModule],
  controllers: [ListPaymentsHttpController, RecordCollectionHttpController],
  providers: [
    PaymentMapper,
    ListPaymentsQueryHandler,
    RecordCollectionService,
    { provide: PAYMENT_REPOSITORY, useClass: PaymentRepository },
    { provide: RENTAL_LOOKUP, useClass: RentalLookupAdapter },
  ],
})
export class PaymentsModule {}
