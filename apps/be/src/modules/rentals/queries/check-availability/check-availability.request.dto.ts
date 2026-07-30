import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class CheckAvailabilityRequestDto {
  @ApiProperty({ example: '2026-08-10', description: 'First rental day (inclusive)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly startDate!: string;

  @ApiProperty({ example: '2026-08-12', description: 'Last rental day (inclusive)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly endDate!: string;
}
