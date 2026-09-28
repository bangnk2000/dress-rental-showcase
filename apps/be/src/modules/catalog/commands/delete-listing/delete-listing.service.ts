import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  DRESS_LISTING_REPOSITORY,
  DressListingRepositoryPort,
} from '../../application/ports/dress-listing.repository.port';
import {
  ListingDeleteOwnerOnlyError,
  ListingNotFoundError,
} from '../../domain/dress-listing.errors';
import { DeleteListingCommand } from './delete-listing.command';

export type DeleteListingResult = Result<
  AggregateID,
  ListingNotFoundError | ListingDeleteOwnerOnlyError
>;

/**
 * DeleteListing (spec §2, R8): the owner deletes any listing; staff only one that was NEVER
 * published. For staff the rule is also IN the DELETE (`AND first_published_at IS NULL`), so a
 * publish landing after the entity check leaves the row alive and answers the same 403 outcome.
 * Attached pairs cascade; dresses are never touched.
 */
@CommandHandler(DeleteListingCommand)
export class DeleteListingService
  implements ICommandHandler<DeleteListingCommand, DeleteListingResult>
{
  constructor(
    @Inject(DRESS_LISTING_REPOSITORY)
    private readonly listingRepo: DressListingRepositoryPort,
  ) {}

  async execute(command: DeleteListingCommand): Promise<DeleteListingResult> {
    const listing = await this.listingRepo.findOneById(command.listingId);
    if (!listing) return Err(new ListingNotFoundError());

    const allowed = listing.assertDeletableBy(command.actorRole);
    if (allowed.isErr()) return Err(allowed.unwrapErr());

    const isOwner = command.actorRole === 'owner';
    const deleted = await this.listingRepo.delete(listing.id, { onlyIfNeverPublished: !isOwner });
    if (deleted > 0) return Ok(listing.id);

    // 0 rows: either someone deleted it meanwhile, or (staff) a publish got in first.
    if (!isOwner && (await this.listingRepo.findOneById(listing.id))) {
      return Err(new ListingDeleteOwnerOnlyError());
    }
    return Err(new ListingNotFoundError());
  }
}
