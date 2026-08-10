import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/**
 * Business rejections of rentals/pickup-rental (422) — ADR 0001 §3. `currentStatus` is present
 * only for `rejected_pickup_not_allowed`: another device already moved the rental on, and the
 * board needs to say which state it is in now.
 */
export class PickupRentalOutcomeDto {
  @ApiProperty({ enum: ['rejected_rental_not_found', 'rejected_pickup_not_allowed'] })
  readonly status!: 'rejected_rental_not_found' | 'rejected_pickup_not_allowed';

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;
}
