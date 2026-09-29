import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { STYLES, Style } from '../../domain/style.value-object';

export class ListPublicDressesRequestDto {
  @ApiPropertyOptional({ enum: STYLES, description: 'Only listings that include this style' })
  @IsOptional()
  @IsIn(STYLES)
  readonly style?: Style;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, description: 'Omit for every visible listing' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  readonly limit?: number;
}
