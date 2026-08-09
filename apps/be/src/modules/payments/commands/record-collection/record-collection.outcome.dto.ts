import { ApiProperty } from '@nestjs/swagger';

export type RecordCollectionOutcomeStatus =
  | 'rejected_rental_not_found'
  | 'rejected_rental_closed'
  | 'rejected_nothing_to_record'
  | 'rejected_deposit_already_recorded'
  | 'rejected_rental_fee_already_recorded';

/** Business rejections of payments/record-collection (422) — ADR 0001 §3. */
export class RecordCollectionOutcomeDto {
  @ApiProperty({
    enum: [
      'rejected_rental_not_found',
      'rejected_rental_closed',
      'rejected_nothing_to_record',
      'rejected_deposit_already_recorded',
      'rejected_rental_fee_already_recorded',
    ],
  })
  readonly status!: RecordCollectionOutcomeStatus;

  @ApiProperty({
    enum: ['returned', 'cancelled'],
    required: false,
    description: 'Why the rental is closed (rejected_rental_closed)',
  })
  readonly currentStatus?: 'returned' | 'cancelled';

  @ApiProperty({
    example: 3000000,
    required: false,
    description: 'The amount already on file for that kind (rejected_*_already_recorded)',
  })
  readonly recordedAmount?: number;
}
