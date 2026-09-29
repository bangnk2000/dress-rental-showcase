import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { LISTING_SLUG_PATTERN } from '../../domain/listing-slug.value-object';
import { STYLES, Style } from '../../domain/style.value-object';
import { ListingSpecsRequestDto } from '../../dtos/listing-specs.request.dto';

/**
 * Partial update: omit a field to keep it. `retailPrice: null` clears it; inside `specs`, an
 * omitted cell is kept and `null` clears it. `photoUrls` replaces the whole list.
 * Publication state is NOT here — publish/unpublish are their own endpoints.
 */
export class UpdateListingRequestDto {
  @ApiPropertyOptional({ example: 'Đầm dạ hội Ánh Trăng' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  readonly name?: string;

  @ApiPropertyOptional({
    example: 'dam-da-hoi-anh-trang',
    description: 'New slug — refused (rejected_listing_slug_locked) once the listing was ever published',
  })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(LISTING_SLUG_PATTERN)
  readonly slug?: string;

  @ApiPropertyOptional({ description: '≤ 160 chars' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  readonly tagline?: string;

  @ApiPropertyOptional({ description: '≤ 2000 chars' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  readonly description?: string;

  @ApiPropertyOptional({ enum: STYLES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(STYLES.length)
  @ArrayUnique()
  @IsIn(STYLES, { each: true })
  readonly styles?: Style[];

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'VND; null clears it' })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly retailPrice?: number | null;

  @ApiPropertyOptional({ type: ListingSpecsRequestDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ListingSpecsRequestDto)
  readonly specs?: ListingSpecsRequestDto;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Photo URLs (http/https), max 10 — replaces the whole list; a PUBLISHED listing must keep ≥ 1',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^https?:\/\/\S+$/, { each: true })
  @Length(1, 2000, { each: true })
  readonly photoUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  readonly isHot?: boolean;
}
