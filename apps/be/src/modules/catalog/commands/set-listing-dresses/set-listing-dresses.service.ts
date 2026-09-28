import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  DRESS_LISTING_REPOSITORY,
  DressListingRepositoryPort,
} from '../../application/ports/dress-listing.repository.port';
import { ListingGoneError } from '../../application/ports/listing-write-conflict.errors';
import {
  ListingDressesNotFoundError,
  ListingNotFoundError,
} from '../../domain/dress-listing.errors';
import { SetListingDressesCommand } from './set-listing-dresses.command';

export type SetListingDressesResult = Result<
  AggregateID,
  ListingNotFoundError | ListingDressesNotFoundError
>;

/**
 * SetListingDresses (spec §2): full replacement of the attached set in ONE transaction (DELETE the
 * dropped pairs, INSERT … ON CONFLICT DO NOTHING the new ones). Idempotent by nature.
 */
@CommandHandler(SetListingDressesCommand)
export class SetListingDressesService
  implements ICommandHandler<SetListingDressesCommand, SetListingDressesResult>
{
  constructor(
    @Inject(DRESS_LISTING_REPOSITORY)
    private readonly listingRepo: DressListingRepositoryPort,
  ) {}

  async execute(command: SetListingDressesCommand): Promise<SetListingDressesResult> {
    const listing = await this.listingRepo.findOneById(command.listingId);
    if (!listing) return Err(new ListingNotFoundError());

    listing.setDresses(command.dressIds, new Date());
    const wanted = listing.dressIds;

    const existing = new Set(await this.listingRepo.findExistingDressIds(wanted));
    const missing = wanted.filter((id) => !existing.has(id));
    if (missing.length > 0) return Err(new ListingDressesNotFoundError(missing));

    try {
      await this.listingRepo.replaceDresses(listing.id, wanted);
    } catch (error) {
      if (error instanceof ListingGoneError) return Err(new ListingNotFoundError(error));
      throw error;
    }
    return Ok(listing.id);
  }
}
