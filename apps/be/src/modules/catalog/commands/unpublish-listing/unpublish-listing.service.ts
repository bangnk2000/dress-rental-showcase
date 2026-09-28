import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  DRESS_LISTING_REPOSITORY,
  DressListingRepositoryPort,
} from '../../application/ports/dress-listing.repository.port';
import { ListingGoneError } from '../../application/ports/listing-write-conflict.errors';
import { ListingNotFoundError } from '../../domain/dress-listing.errors';
import { UnpublishListingCommand } from './unpublish-listing.command';

export type UnpublishListingResult = Result<AggregateID, ListingNotFoundError>;

/**
 * UnpublishListing (spec §2): hide from the web. Idempotent; only not_found rejects. It never
 * clears `first_published_at` — hiding does not unlock the slug nor staff deletion (§6.M).
 */
@CommandHandler(UnpublishListingCommand)
export class UnpublishListingService
  implements ICommandHandler<UnpublishListingCommand, UnpublishListingResult>
{
  constructor(
    @Inject(DRESS_LISTING_REPOSITORY)
    private readonly listingRepo: DressListingRepositoryPort,
  ) {}

  async execute(command: UnpublishListingCommand): Promise<UnpublishListingResult> {
    const listing = await this.listingRepo.findOneById(command.listingId);
    if (!listing) return Err(new ListingNotFoundError());

    const now = new Date();
    listing.unpublish(now);
    try {
      await this.listingRepo.markUnpublished(listing.id, now);
    } catch (error) {
      if (error instanceof ListingGoneError) return Err(new ListingNotFoundError(error));
      throw error;
    }
    return Ok(listing.id);
  }
}
