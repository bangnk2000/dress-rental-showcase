import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/** Business rejections of rentals/return-rental (422) — ADR 0001 §3. */
export class ReturnRentalOutcomeDto {
  @ApiProperty({ enum: ['rejected_rental_not_found', 'rejected_return_not_allowed'] })
  readonly status!: 'rejected_rental_not_found' | 'rejected_return_not_allowed';

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;
}
