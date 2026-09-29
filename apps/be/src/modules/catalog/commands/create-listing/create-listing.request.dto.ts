import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateListingRequestDto {
  @ApiProperty({ example: 'Đầm dạ hội Ánh Trăng' })
  @IsString()
  @Length(1, 120)
  readonly name!: string;

  @ApiPropertyOptional({
    example: 'dam-da-hoi-anh-trang',
    description:
      'Public URL key; omit to derive it from the name (diacritics stripped, đ→d). Locked after the first publish.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(LISTING_SLUG_PATTERN)
  readonly slug?: string;

  @ApiPropertyOptional({ example: 'Lấp lánh như ánh trăng', description: '≤ 160 chars; default ""' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  readonly tagline?: string;

  @ApiPropertyOptional({ description: '≤ 2000 chars; default ""' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  readonly description?: string;

  @ApiProperty({ enum: STYLES, isArray: true, example: ['short', 'silk'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(STYLES.length)
  @ArrayUnique()
  @IsIn(STYLES, { each: true })
  readonly styles!: Style[];

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 4500000,
    description: 'Market price of a new one (VND), for comparison only — NOT the purchase price',
  })
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
    description: 'Photo URLs (http/https), max 10; the first one is the cover',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^https?:\/\/\S+$/, { each: true })
  @Length(1, 2000, { each: true })
  readonly photoUrls?: string[];

  @ApiPropertyOptional({ example: false, description: 'Hot badge, switched by hand' })
  @IsOptional()
  @IsBoolean()
  readonly isHot?: boolean;
}
