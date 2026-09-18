import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/**
 * Business rejections of rentals/update-rental (422) — outcome catalog in
 * docs/adr/0001-outcome-model-at-the-http-boundary.md §3 and the use-case spec
 * docs/design/rentals/update-rental.md §2. The dress codes are the create-rental ones (same rules,
 * same payload: `dressIds` names ONLY the offending dresses); `rejected_update_not_allowed`
 * carries the status that closed the rental.
 */
export class UpdateRentalOutcomeDto {
  @ApiProperty({
    enum: [
      'rejected_rental_not_found',
      'rejected_update_not_allowed',
      'rejected_dress_not_found',
      'rejected_dress_retired',
      'rejected_dress_unavailable',
    ],
  })
  readonly status!:
    | 'rejected_rental_not_found'
    | 'rejected_update_not_allowed'
    | 'rejected_dress_not_found'
    | 'rejected_dress_retired'
    | 'rejected_dress_unavailable';

  @ApiProperty({ type: [String], format: 'uuid', required: false })
  readonly dressIds?: string[];

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;
}
