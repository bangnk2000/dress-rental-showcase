import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';

export class GetTodayBoardRequestDto {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description: "Board date; defaults to the server's current date",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  // strict ISO check on top of the shape: rejects calendar nonsense like 2026-02-30
  // BEFORE it reaches the ::date cast (which would 500, not 400).
  @IsISO8601({ strict: true })
  readonly date?: string;
}
