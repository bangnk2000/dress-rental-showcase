import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../domain/rental.types';

/** One blocking booking of a dress, day precision, all bounds inclusive. */
export class BookedRangeDto {
  @ApiProperty({ format: 'uuid' })
  readonly rentalId!: string;

  @ApiProperty({ example: '2026-08-01', description: 'First rental day (inclusive)' })
  readonly startDate!: string;

  @ApiProperty({ example: '2026-08-03', description: 'Last rental day (inclusive)' })
  readonly endDate!: string;

  @ApiProperty({
    example: '2026-08-05',
    description: 'Last day the dress is blocked, cleaning buffer included (inclusive)',
  })
  readonly blockedUntilDate!: string;

  @ApiProperty({ enum: ['booked', 'out', 'returned', 'cancelled'], example: 'booked' })
  readonly status!: RentalStatus;
}
