import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of catalog/publish-listing (422) — ADR 0001 §3. `missing` is present only
 * for `rejected_listing_not_publishable` and names EVERY unmet requirement.
 */
export class PublishListingOutcomeDto {
  @ApiProperty({ enum: ['rejected_listing_not_found', 'rejected_listing_not_publishable'] })
  readonly status!: 'rejected_listing_not_found' | 'rejected_listing_not_publishable';

  @ApiProperty({
    enum: ['photo', 'active_dress'],
    isArray: true,
    required: false,
    description: 'What the listing lacks: a photo and/or an attached active dress',
  })
  readonly missing?: ('photo' | 'active_dress')[];
}
