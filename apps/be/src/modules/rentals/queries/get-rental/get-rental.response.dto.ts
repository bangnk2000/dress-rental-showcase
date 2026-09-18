import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';
import { RentalDressDto } from '../../dtos/rental-dress.response.dto';

/** A dress on the rental detail — the list's dress row plus its calendar block. */
export class RentalDetailDressDto extends RentalDressDto {
  @ApiProperty({
    example: '2026-08-05',
    description:
      'Last day this dress is held for the rental, cleaning buffer included (inclusive) — the derived "cleaning" state after the return date',
  })
  readonly blockedUntilDate!: string;

  @ApiProperty({
    example: true,
    description: 'false once the rental is cancelled — the calendar is free again, the row is history',
  })
  readonly blocking!: boolean;
}

/**
 * One rental in full (FR-RENT-12). A SUPERSET of RentalListItemDto — same field names, so the
 * money dialog and the collect form that take a list item accept a detail as well.
 */
export class RentalDetailDto {
  @ApiProperty({ format: 'uuid' })
  readonly rentalId!: string;

  @ApiProperty({ example: 'Nguyễn Thị Hoa' })
  readonly customerName!: string;

  @ApiProperty({ example: '0903123456' })
  readonly customerPhone!: string;

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], example: 'booked' })
  readonly status!: RentalStatus;

  @ApiProperty({ example: '2026-08-01', description: 'First rental day (inclusive)' })
  readonly startDate!: string;

  @ApiProperty({ example: '2026-08-03', description: 'Last rental day (inclusive)' })
  readonly endDate!: string;

  @ApiProperty({ example: 'Khách quen', nullable: true, type: String })
  readonly notes!: string | null;

  @ApiProperty({
    example: 100000,
    description:
      'Discount on the rental fee in VND (FR-RENT-11); 0 = none. Expected rental fee = Σ dresses.agreedPrice − discountAmount.',
  })
  readonly discountAmount!: number;

  @ApiProperty({ example: '2026-07-30T09:00:00.000Z' })
  readonly createdAt!: string;

  @ApiProperty({
    example: '2026-07-31T09:00:00.000Z',
    description: 'Last change to the rental (status move or owner edit)',
  })
  readonly updatedAt!: string;

  @ApiProperty({ type: [RentalDetailDressDto], description: 'Sorted by dress code' })
  readonly dresses!: RentalDetailDressDto[];
}
