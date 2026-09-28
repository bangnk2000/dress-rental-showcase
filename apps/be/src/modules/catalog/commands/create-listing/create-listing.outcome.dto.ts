import { ApiProperty } from '@nestjs/swagger';

/** Business rejection of catalog/create-listing (422) — ADR 0001 §3. */
export class CreateListingOutcomeDto {
  @ApiProperty({ enum: ['rejected_listing_slug_taken'] })
  readonly status!: 'rejected_listing_slug_taken';

  @ApiProperty({ description: 'The slug that is already in use' })
  readonly slug!: string;
}
