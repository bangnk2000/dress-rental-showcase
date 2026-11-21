import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/**
 * Business rejections of rentals/pickup-rental (422) — ADR 0001 §3. `currentStatus` is present
 * only for `rejected_pickup_not_allowed`: another device already moved the rental on, and the
 * board needs to say which state it is in now. FR-RENT-14 adds the deposit gate.
 */
export class PickupRentalOutcomeDto {
  @ApiProperty({
    enum: [
      'rejected_rental_not_found',
      'rejected_pickup_not_allowed',
      'rejected_deposit_not_collected',
      'rejected_deposit_already_recorded',
    ],
  })
  readonly status!:
    | 'rejected_rental_not_found'
    | 'rejected_pickup_not_allowed'
    | 'rejected_deposit_not_collected'
    | 'rejected_deposit_already_recorded';

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;

  @ApiProperty({
    required: false,
    description: 'Deposit already on file (rejected_deposit_already_recorded)',
  })
  readonly recordedAmount?: number;
}
