import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OCCASIONS, Occasion } from '../../domain/occasion.value-object';

export class ListPublicDressesRequestDto {
  @ApiPropertyOptional({ enum: OCCASIONS, description: 'Only listings that include this occasion' })
  @IsOptional()
  @IsIn(OCCASIONS)
  readonly occasion?: Occasion;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, description: 'Omit for every visible listing' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  readonly limit?: number;
}
