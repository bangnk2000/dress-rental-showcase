import { ApiProperty } from '@nestjs/swagger';

/** Business rejection of catalog/unpublish-listing (422) — ADR 0001 §3. */
export class UnpublishListingOutcomeDto {
  @ApiProperty({ enum: ['rejected_listing_not_found'] })
  readonly status!: 'rejected_listing_not_found';
}
