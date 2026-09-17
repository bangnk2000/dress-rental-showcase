import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';
import { RentalDressDto } from '../../dtos/rental-dress.response.dto';

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

  @ApiProperty({ type: [RentalDressDto] })
  readonly dresses!: RentalDressDto[];
}

export class TodayBoardResponseDto {
  @ApiProperty({ example: '2026-08-01', description: 'The date the board was computed for' })
  readonly date!: string;

  @ApiProperty({
    type: [TodayBoardRentalDto],
    description:
      "Rentals starting on the date: the booked ones still to hand out first, then the ones already handed out ('out') so the day's hand-outs stay visible",
  })
  readonly dueOut!: TodayBoardRentalDto[];

  @ApiProperty({
    type: [TodayBoardRentalDto],
    description: 'Not-yet-returned rentals ending on the date — dresses coming back',
  })
  readonly dueBack!: TodayBoardRentalDto[];

  @ApiProperty({
    type: [TodayBoardRentalDto],
    description: 'Not-yet-returned rentals whose last day is already past',
  })
  readonly overdue!: TodayBoardRentalDto[];
}
