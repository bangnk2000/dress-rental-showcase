import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/**
 * Business rejections of rentals/cancel-rental — ADR 0001 §3. `forbidden` is rendered at **403**
 * (a denial NAMED in the use-case spec, not a guard denial); the rest at 422.
 * Since rentals/cancel-with-refund (2026-11-07) a BOOKED rental with money on file cancels with
 * refunds; only an OUT rental with money is `rejected_cancel_has_payments`.
 */
export class CancelRentalOutcomeDto {
  @ApiProperty({
    enum: [
      'rejected_rental_not_found',
      'rejected_cancel_not_allowed',
      'rejected_cancel_has_payments',
      'rejected_cancel_basis_changed',
      'rejected_refund_exceeds_collected',
      'rejected_retention_note_required',
      'forbidden',
    ],
  })
  readonly status!:
    | 'rejected_rental_not_found'
    | 'rejected_cancel_not_allowed'
    | 'rejected_cancel_has_payments'
    | 'rejected_cancel_basis_changed'
    | 'rejected_refund_exceeds_collected'
    | 'rejected_retention_note_required'
    | 'forbidden';

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;

  @ApiProperty({
    enum: ['cancel_retention_requires_owner'],
    required: false,
    description: 'Why the denial happened — only set for status=forbidden',
  })
  readonly reason?: 'cancel_retention_requires_owner';

  @ApiProperty({
    required: false,
    description: 'Deposit on file (rejected_cancel_basis_changed)',
  })
  readonly collectedDeposit?: number;

  @ApiProperty({
    required: false,
    description: 'Rental fee on file (rejected_cancel_basis_changed)',
  })
  readonly collectedRentalFee?: number;

  @ApiProperty({
    enum: ['deposit', 'rental_fee'],
    required: false,
    description: 'Which refund exceeded what was collected (rejected_refund_exceeds_collected)',
  })
  readonly kind?: 'deposit' | 'rental_fee';

  @ApiProperty({ required: false, description: 'Collected amount of `kind`' })
  readonly collected?: number;

  @ApiProperty({ required: false, description: 'Refund the client tried to record for `kind`' })
  readonly submitted?: number;

  @ApiProperty({
    required: false,
    description: 'Money the cancel would keep (forbidden / rejected_retention_note_required)',
  })
  readonly retainedAmount?: number;
}
