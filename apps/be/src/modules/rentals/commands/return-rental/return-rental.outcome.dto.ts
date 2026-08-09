import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

/**
 * Business rejections of rentals/return-rental — ADR 0001 §3. `forbidden` is rendered at **403**
 * (a denial NAMED in the use-case spec, not a guard denial); the rest at 422.
 */
export class ReturnRentalOutcomeDto {
  @ApiProperty({
    enum: [
      'rejected_rental_not_found',
      'rejected_return_not_allowed',
      'rejected_waiver_note_required',
      'rejected_deposit_basis_changed',
      'forbidden',
    ],
  })
  readonly status!:
    | 'rejected_rental_not_found'
    | 'rejected_return_not_allowed'
    | 'rejected_waiver_note_required'
    | 'rejected_deposit_basis_changed'
    | 'forbidden';

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], required: false })
  readonly currentStatus?: RentalStatus;

  @ApiProperty({
    enum: ['late_fee_waiver_requires_owner'],
    required: false,
    description: 'Why the denial happened — only set for status=forbidden',
  })
  readonly reason?: 'late_fee_waiver_requires_owner';

  @ApiProperty({
    required: false,
    description: 'Late fee the shop should charge, so the UI can state the number (FR-RENT-09)',
  })
  readonly suggestedLateFee?: number;

  @ApiProperty({ required: false, description: 'Late fee the client tried to charge' })
  readonly submittedLateFee?: number;

  @ApiProperty({
    required: false,
    description:
      'Deposit currently on file, so the screen can re-derive the refund it offered (rejected_deposit_basis_changed, FR-PAY-02)',
  })
  readonly collectedDeposit?: number;
}
