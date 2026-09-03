import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class ListDressesRequestDto {
  @ApiPropertyOptional({ description: 'Search in code and name', example: 'VD-01' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  readonly q?: string;

  @ApiPropertyOptional({ enum: ['active', 'retired'] })
  @IsOptional()
  @IsIn(['active', 'retired'])
  readonly status?: 'active' | 'retired';

  @ApiPropertyOptional({ description: 'Only dresses in this category (FR-CAT-07)' })
  @IsOptional()
  @IsUUID()
  readonly categoryId?: string;

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
