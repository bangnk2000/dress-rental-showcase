import { ApiProperty } from '@nestjs/swagger';
import { BookedRangeDto } from '../../dtos/booked-range.response.dto';

export class BookedRangeListResponseDto {
  @ApiProperty({ type: [BookedRangeDto], description: 'Blocking bookings, ordered by start' })
  readonly data!: BookedRangeDto[];
}
