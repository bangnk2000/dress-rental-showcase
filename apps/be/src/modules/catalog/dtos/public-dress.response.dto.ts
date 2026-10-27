import { ApiProperty } from '@nestjs/swagger';
import { LISTING_BADGES, ListingBadge } from '../domain/listing-badge';
import { STYLES, Style } from '../domain/style.value-object';

/**
 * ANONYMOUS read models (docs/design/catalog/public-listing.md §Contract, R6). A WHITELIST: no
 * internal id, no full dress code (only the BASE codes — owner decision 2026-10-27), notes, deposit, purchase price, category, nor anything about
 * customers/rentals. Adding a field here is a public-surface decision, not a refactor — the e2e
 * suite compares the EXACT key sets.
 */

export class PublicImageDto {
  @ApiProperty({ description: 'Original URL (R2 or a legacy link); optimisation is the renderer’s job' })
  readonly src!: string;

  @ApiProperty({ example: 'Đầm dạ hội Ánh Trăng — ảnh 2' })
  readonly alt!: string;
}

export class PublicDressSummaryDto {
  @ApiProperty({ example: 'dam-da-hoi-anh-trang' })
  readonly slug!: string;

  @ApiProperty({ example: 'Đầm dạ hội Ánh Trăng' })
  readonly name!: string;

  @ApiProperty({ example: 'Lấp lánh như ánh trăng' })
  readonly tagline!: string;

  @ApiProperty({ enum: STYLES, isArray: true })
  readonly styles!: Style[];

  @ApiProperty({
    type: [String],
    example: ['VAY1'],
    description:
      'Base codes of the active dresses (duplicate suffix stripped: VAY1, VAY1_1 → VAY1), distinct, natural order',
  })
  readonly codes!: string[];

  @ApiProperty({ enum: LISTING_BADGES, description: 'hot > new (first published ≤ 30 days) > available' })
  readonly badge!: ListingBadge;

  @ApiProperty({
    example: 1500000,
    description: 'VND for ONE rental of 2 days (the web writes "X / 2 ngày") — min over the active dresses',
  })
  readonly rentalPrice!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Reference retail price (VND)' })
  readonly retailPrice!: number | null;

  @ApiProperty({ type: PublicImageDto })
  readonly cover!: PublicImageDto;
}

export class PublicSizeDto {
  @ApiProperty({ example: 'M', description: 'XS, S, M, L, XL, then free sizes A→Z, "Freesize" last' })
  readonly label!: string;

  @ApiProperty({ description: 'At least one active dress of this size (bookings are not considered)' })
  readonly available!: boolean;
}

export class PublicDressSpecsDto {
  @ApiProperty({ type: String, nullable: true })
  readonly material!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly silhouette!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly length!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly color!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Free-text styles cell' })
  readonly styles!: string | null;
}

export class PublicDressDetailDto extends PublicDressSummaryDto {
  @ApiProperty()
  readonly description!: string;

  @ApiProperty({ type: [PublicImageDto], description: 'Every photo in order; the first is the cover' })
  readonly images!: PublicImageDto[];

  @ApiProperty({ type: [PublicSizeDto] })
  readonly sizes!: PublicSizeDto[];

  @ApiProperty({ type: PublicDressSpecsDto })
  readonly specs!: PublicDressSpecsDto;
}
