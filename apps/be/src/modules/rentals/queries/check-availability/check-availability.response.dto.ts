import { ApiProperty } from '@nestjs/swagger';
import { BookedRangeDto } from '../../dtos/booked-range.response.dto';

export class AvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly dressId!: string;

  @ApiProperty({ example: '2026-08-10', description: 'First rental day asked about (inclusive)' })
  readonly startDate!: string;

  @ApiProperty({ example: '2026-08-12', description: 'Last rental day asked about (inclusive)' })
  readonly endDate!: string;

  @ApiProperty({
    description:
      'True when booking [startDate, endDate] would succeed — the cleaning buffer is included and a retired dress is never available',
  })
  readonly available!: boolean;

  @ApiProperty({
    type: [BookedRangeDto],
    description:
      'Blocking bookings that overlap the asked period extended by the cleaning buffer (empty when available)',
  })
  readonly conflicts!: BookedRangeDto[];
}
