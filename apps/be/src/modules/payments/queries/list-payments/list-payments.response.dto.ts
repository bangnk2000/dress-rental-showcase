import { ApiProperty } from '@nestjs/swagger';

export type PaymentKind =
  | 'deposit'
  | 'deposit_refund'
  | 'rental_fee'
  | 'late_fee'
  | 'damage_fee';

/** One money movement of a rental, as the return flow recorded it. */
export class PaymentDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    enum: ['deposit', 'deposit_refund', 'rental_fee', 'late_fee', 'damage_fee'],
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

export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentDto], description: 'Movements, oldest first' })
  readonly data!: PaymentDto[];
}
