import { ApiProperty } from '@nestjs/swagger';

/** Business rejection of catalog/delete-listing (422) — ADR 0001 §3. */
export class DeleteListingOutcomeDto {
  @ApiProperty({ enum: ['rejected_listing_not_found'] })
  readonly status!: 'rejected_listing_not_found';
}

/**
 * Named 403 OUTCOME of catalog/delete-listing (ADR 0001 §3, spec §6.M): staff tried to delete a
 * listing that was ever published. Same family as `purchase_price_owner_only` — the use case ran
 * and refused; this is not the guard envelope.
 */
export class ListingDeleteForbiddenOutcomeDto {
  @ApiProperty({ enum: ['forbidden'] })
  readonly status!: 'forbidden';

  @ApiProperty({ enum: ['listing_published_owner_only'] })
  readonly reason!: 'listing_published_owner_only';
}
