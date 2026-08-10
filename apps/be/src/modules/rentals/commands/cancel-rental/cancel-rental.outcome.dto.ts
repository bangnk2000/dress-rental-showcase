import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/**
 * Business rejections of rentals/cancel-rental (422) — ADR 0001 §3. Since FR-RENT-10, an OUT
 * rental may cancel too (a mis-created born-out entry) — but only while its ledger is empty:
 * recorded money must leave through the return flow (`rejected_cancel_has_payments`).
 */
export class CancelRentalOutcomeDto {
  @ApiProperty({
    enum: [
      'rejected_rental_not_found',
      'rejected_cancel_not_allowed',
      'rejected_cancel_has_payments',
    ],
  })
  readonly status!:
    | 'rejected_rental_not_found'
    | 'rejected_cancel_not_allowed'
    | 'rejected_cancel_has_payments';

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;
}
