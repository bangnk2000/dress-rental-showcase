import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  DRESS_LISTING_REPOSITORY,
  DressListingRepositoryPort,
} from '../../application/ports/dress-listing.repository.port';
import {
  ListingGoneError,
  ListingNoActiveDressConflictError,
  ListingPhotoCheckError,
} from '../../application/ports/listing-write-conflict.errors';
import {
  ListingNotFoundError,
  ListingNotPublishableError,
} from '../../domain/dress-listing.errors';
import { PublishListingCommand } from './publish-listing.command';

export type PublishListingResult = Result<
  AggregateID,
  ListingNotFoundError | ListingNotPublishableError
>;

/**
 * PublishListing (spec §2): needs a photo AND an active dress; already published → Ok
 * (idempotent). The write COALESCEs both timestamps, so `first_published_at` is set once, ever.
 */
@CommandHandler(PublishListingCommand)
export class PublishListingService
  implements ICommandHandler<PublishListingCommand, PublishListingResult>
{
  constructor(
    @Inject(DRESS_LISTING_REPOSITORY)
    private readonly listingRepo: DressListingRepositoryPort,
  ) {}

  async execute(command: PublishListingCommand): Promise<PublishListingResult> {
    const listing = await this.listingRepo.findOneById(command.listingId);
    if (!listing) return Err(new ListingNotFoundError());

    const now = new Date();
    const activeDressCount = await this.listingRepo.countActiveDresses(listing.id);
    const published = listing.publish(now, activeDressCount);
    if (published.isErr()) return Err(published.unwrapErr());

    try {
      await this.listingRepo.markPublished(listing.id, now);
    } catch (error) {
      if (error instanceof ListingPhotoCheckError) {
        // The photos were removed after our load — the CHECK is the last net (R3).
        return Err(new ListingNotPublishableError(['photo'], error));
      }
      if (error instanceof ListingNoActiveDressConflictError) {
        // The last active dress was detached/retired after our count — the write's EXISTS caught it.
        return Err(new ListingNotPublishableError(['active_dress'], error));
      }
      if (error instanceof ListingGoneError) return Err(new ListingNotFoundError(error));
      throw error;
    }
    return Ok(listing.id);
  }
}
