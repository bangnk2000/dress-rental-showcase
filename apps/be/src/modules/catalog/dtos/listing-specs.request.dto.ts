import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/**
 * The five free-text spec cells of a listing (each ≤ 120). On create an omitted cell is null; on
 * update omit = keep, explicit null = clear.
 */
export class ListingSpecsRequestDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Lụa satin' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  readonly material?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Chữ A' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  readonly silhouette?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Dài chấm gót' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  readonly length?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Đỏ rượu' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  readonly color?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Dạ tiệc, sinh nhật',
    description: 'Free text shown as the "styles" spec cell on the web (not the style codes)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  readonly stylesText?: string | null;
}
