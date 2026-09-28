import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of catalog/update-listing (422) — ADR 0001 §3. `slug` is present only for
 * `rejected_listing_slug_taken`.
 */
export class UpdateListingOutcomeDto {
  @ApiProperty({
    enum: [
      'rejected_listing_not_found',
      'rejected_listing_slug_taken',
      'rejected_listing_slug_locked',
      'rejected_listing_photo_required',
    ],
  })
  readonly status!:
    | 'rejected_listing_not_found'
    | 'rejected_listing_slug_taken'
    | 'rejected_listing_slug_locked'
    | 'rejected_listing_photo_required';

  @ApiProperty({ required: false, description: 'The slug that is already in use' })
  readonly slug?: string;
}
