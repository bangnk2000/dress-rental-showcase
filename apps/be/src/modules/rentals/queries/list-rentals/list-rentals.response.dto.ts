import { ApiProperty } from '@nestjs/swagger';
import { RentalStatus } from '../../domain/rental.types';
import { RentalDressDto } from '../../dtos/rental-dress.response.dto';

export class RentalListItemDto {
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

  @ApiProperty({ example: '2026-07-30T09:00:00.000Z' })
  readonly createdAt!: string;

  @ApiProperty({ type: [RentalDressDto] })
  readonly dresses!: RentalDressDto[];
}

export class RentalListResponseDto {
  @ApiProperty({ type: [RentalListItemDto] })
  readonly data!: RentalListItemDto[];

  @ApiProperty({ example: 42 })
  readonly count!: number;

  @ApiProperty({ example: 20 })
  readonly limit!: number;

  @ApiProperty({ example: 1 })
  readonly page!: number;
}
