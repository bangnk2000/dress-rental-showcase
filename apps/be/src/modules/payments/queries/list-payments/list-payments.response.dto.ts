import { ApiProperty } from '@nestjs/swagger';

export type PaymentKind =
  | 'deposit'
  | 'deposit_refund'
  | 'rental_fee'
  | 'rental_fee_refund'
  | 'late_fee'
  | 'damage_fee';

/** One money movement of a rental, as the return flow recorded it. */
export class PaymentDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    enum: ['deposit', 'deposit_refund', 'rental_fee', 'rental_fee_refund', 'late_fee', 'damage_fee'],
    example: 'deposit_refund',
  })
  readonly kind!: PaymentKind;

  @ApiProperty({ example: 2800000, description: 'VND, integer' })
  readonly amount!: number;

  @ApiProperty({ example: 'Trễ 1 ngày', nullable: true, type: String })
  readonly note!: string | null;

  @ApiProperty({ example: '2026-08-04T10:00:00.000Z' })
  readonly createdAt!: string;
}

/**
 * Per-kind totals of the movements above. BE owns this arithmetic so the screens that spend it —
 * the return dialog refunds the deposit ACTUALLY collected (FR-PAY-02 R7) — read one number
 * instead of each summing a movement list their own way.
 */
export class PaymentSummaryDto {
  @ApiProperty({ example: 3000000, description: 'Deposit collected, VND' })
  readonly deposit!: number;

  @ApiProperty({ example: 1500000, description: 'Rental fee collected, VND' })
  readonly rentalFee!: number;

  @ApiProperty({ example: 2800000, description: 'Deposit handed back, VND' })
  readonly depositRefund!: number;

  @ApiProperty({
    example: 0,
    description: 'Rental fee handed back when a prepaid booking was cancelled, VND',
  })
  readonly rentalFeeRefund!: number;

  @ApiProperty({ example: 200000, description: 'Late fees charged, VND' })
  readonly lateFee!: number;

  @ApiProperty({ example: 0, description: 'Damage fees charged, VND' })
  readonly damageFee!: number;
}

export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentDto], description: 'Movements, oldest first' })
  readonly data!: PaymentDto[];

  @ApiProperty({ type: PaymentSummaryDto })
  readonly summary!: PaymentSummaryDto;
}
