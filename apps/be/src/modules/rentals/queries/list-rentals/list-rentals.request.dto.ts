import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class ListRentalsRequestDto {
  @ApiPropertyOptional({ description: 'Search in customer name and phone', example: 'Hoa' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  readonly q?: string;

  @ApiPropertyOptional({ enum: ['booked', 'out', 'returned', 'cancelled'] })
  @IsOptional()
  @IsIn(['booked', 'out', 'returned', 'cancelled'])
  readonly status?: 'booked' | 'out' | 'returned' | 'cancelled';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;
}
