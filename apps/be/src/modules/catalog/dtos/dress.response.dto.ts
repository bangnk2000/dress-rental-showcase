import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A public listing this dress belongs to (the "Thuộc mẫu" line of the dress detail). */
export class DressListingRefDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'Đầm dạ hội Ánh Trăng' })
  readonly name!: string;
}

export class DressResponseDto {
  @ApiProperty({ example: '6f1e2c3a-6b1a-4e6a-9f57-0b6c2f1e2c3a' })
  readonly id!: string;

  @ApiProperty({ example: 'VD-012' })
  readonly code!: string;

  @ApiProperty({ example: 'Váy cưới đuôi cá ren trắng' })
  readonly name!: string;

  @ApiProperty({ example: 'M', nullable: true, type: String })
  readonly sizeLabel!: string | null;

  @ApiProperty({ example: 1500000, description: 'Rental price in VND' })
  readonly rentalPrice!: number;

  @ApiProperty({ example: 3000000, description: 'Standard deposit in VND' })
  readonly depositAmount!: number;

  @ApiProperty({ enum: ['active', 'retired'], example: 'active' })
  readonly status!: 'active' | 'retired';

  @ApiProperty({ nullable: true, type: String })
  readonly notes!: string | null;

  @ApiProperty({ type: [String], description: 'Photo links (staff-pasted; no upload in MVP)' })
  readonly photoUrls!: string[];

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Category id (0..1 per dress; null = unclassified). Names come from GET /categories — a tiny cached list, so the FE joins client-side instead of every dress row carrying the name.',
  })
  readonly categoryId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description:
      'What the shop paid (VND, FR-CAT-05). OWNER-ONLY: omitted entirely for staff (absence = not your field; null = the owner has not entered it). Feeds no computation.',
  })
  readonly purchasePrice?: number | null;

  @ApiProperty({
    type: [DressListingRefDto],
    description: 'Public listings (FR-CAT-09) this dress is attached to, by name; [] when none',
  })
  readonly listings!: DressListingRefDto[];

  @ApiProperty({ example: '2026-07-30T10:00:00.000Z' })
  readonly createdAt!: string;
}
