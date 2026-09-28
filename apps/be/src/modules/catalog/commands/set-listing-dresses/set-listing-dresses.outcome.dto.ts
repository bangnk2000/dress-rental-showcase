import { ApiProperty } from '@nestjs/swagger';

/**
 * Business rejections of catalog/set-listing-dresses (422) — ADR 0001 §3. `dressIds` (the ids
 * that do not exist) is present only for `rejected_dress_not_found`.
 */
export class SetListingDressesOutcomeDto {
  @ApiProperty({ enum: ['rejected_listing_not_found', 'rejected_dress_not_found'] })
  readonly status!: 'rejected_listing_not_found' | 'rejected_dress_not_found';

  @ApiProperty({ type: [String], required: false, description: 'Dress ids that do not exist' })
  readonly dressIds?: string[];
}
