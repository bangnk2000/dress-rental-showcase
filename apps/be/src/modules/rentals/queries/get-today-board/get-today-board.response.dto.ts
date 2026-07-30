import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';

export class TodayBoardDressDto {
  @ApiProperty({ format: 'uuid' })
  readonly dressId!: string;

  @ApiProperty({ example: 'VD-001' })
  readonly code!: string;

  @ApiProperty({ example: 'Váy cưới ren trắng' })
  readonly name!: string;
}

/** One rental the staff must hand out or take back on the board's date. */
export class TodayBoardRentalDto {
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

  @ApiProperty({ type: [TodayBoardDressDto] })
  readonly dresses!: TodayBoardDressDto[];
}

export class TodayBoardResponseDto {
  @ApiProperty({ example: '2026-08-01', description: 'The date the board was computed for' })
  readonly date!: string;

  @ApiProperty({
    type: [TodayBoardRentalDto],
    description: 'Booked rentals starting on the date — dresses to hand out',
  })
  readonly dueOut!: TodayBoardRentalDto[];

  @ApiProperty({
    type: [TodayBoardRentalDto],
    description: 'Not-yet-returned rentals ending on the date — dresses coming back',
  })
  readonly dueBack!: TodayBoardRentalDto[];
}
