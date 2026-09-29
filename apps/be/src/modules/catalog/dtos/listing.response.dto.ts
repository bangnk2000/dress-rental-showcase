import { ApiProperty } from '@nestjs/swagger';
import { STYLES, Style } from '../domain/style.value-object';

/** CMS read models of a DressListing (staff-only; the web gets the whitelisted public DTOs). */

export class ListingSpecsDto {
  @ApiProperty({ type: String, nullable: true })
  readonly material!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly silhouette!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly length!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly color!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly stylesText!: string | null;
}

/** One attached dress — enough to draw the "Size & váy" table and the price-mismatch warning. */
export class ListingDressDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'VD-012' })
  readonly code!: string;

  @ApiProperty({ example: 'Váy dạ hội đỏ' })
  readonly name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'M', description: 'null = Freesize on the web' })
  readonly sizeLabel!: string | null;

  @ApiProperty({ example: 1500000, description: 'Rental price in VND' })
  readonly rentalPrice!: number;

  @ApiProperty({ enum: ['active', 'retired'] })
  readonly status!: 'active' | 'retired';
}

export class ListingDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'dam-da-hoi-anh-trang' })
  readonly slug!: string;

  @ApiProperty({ example: 'Đầm dạ hội Ánh Trăng' })
  readonly name!: string;

  @ApiProperty()
  readonly tagline!: string;

  @ApiProperty()
  readonly description!: string;

  @ApiProperty({ enum: STYLES, isArray: true })
  readonly styles!: Style[];

  @ApiProperty({ type: Number, nullable: true, description: 'Reference retail price in VND' })
  readonly retailPrice!: number | null;

  @ApiProperty({ type: ListingSpecsDto })
  readonly specs!: ListingSpecsDto;

  @ApiProperty({ type: [String], description: 'Photo URLs; the first one is the cover' })
  readonly photoUrls!: string[];

  @ApiProperty()
  readonly isHot!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Non-null = published now' })
  readonly publishedAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Non-null = was ever published: the slug is locked and only the owner may delete',
  })
  readonly firstPublishedAt!: string | null;

  @ApiProperty({ type: [ListingDressDto] })
  readonly dresses!: ListingDressDto[];

  @ApiProperty({ example: '2026-09-25T10:00:00.000Z' })
  readonly createdAt!: string;

  @ApiProperty({ example: '2026-09-25T10:00:00.000Z' })
  readonly updatedAt!: string;
}

export class ListingListItemDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly slug!: string;

  @ApiProperty()
  readonly name!: string;

  @ApiProperty({ enum: STYLES, isArray: true })
  readonly styles!: Style[];

  @ApiProperty()
  readonly isHot!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'First photo URL, null when none' })
  readonly coverUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly publishedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly firstPublishedAt!: string | null;

  @ApiProperty({ description: 'Attached dresses (any status)' })
  readonly dressCount!: number;

  @ApiProperty({ description: 'Attached dresses that are active' })
  readonly activeDressCount!: number;

  @ApiProperty({ description: 'Distinct sizes among the active attached dresses ("còn" sizes)' })
  readonly activeSizeCount!: number;

  @ApiProperty({
    description:
      'Actually visible on the web = published AND ≥ 1 active dress (R5). published && !visibleOnWeb = "Ẩn (hết váy)"',
  })
  readonly visibleOnWeb!: boolean;

  @ApiProperty()
  readonly updatedAt!: string;
}

export class ListingListResponseDto {
  @ApiProperty({ type: [ListingListItemDto] })
  readonly data!: ListingListItemDto[];
}
