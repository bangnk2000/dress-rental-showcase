import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/** Business rejections of rentals/cancel-rental (422) — ADR 0001 §3. */
export class CancelRentalOutcomeDto {
  @ApiProperty({ enum: ['rejected_rental_not_found', 'rejected_cancel_not_allowed'] })
  readonly status!: 'rejected_rental_not_found' | 'rejected_cancel_not_allowed';

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;
}
