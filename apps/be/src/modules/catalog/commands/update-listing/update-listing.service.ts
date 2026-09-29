import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import {
  DRESS_LISTING_REPOSITORY,
  DressListingRepositoryPort,
} from '../../application/ports/dress-listing.repository.port';
import {
  ListingGoneError,
  ListingPhotoCheckError,
  ListingSlugConflictError,
  ListingSlugLockedConflictError,
} from '../../application/ports/listing-write-conflict.errors';
import {
  ListingNotFoundError,
  ListingPhotoRequiredError,
  ListingSlugLockedError,
  ListingSlugTakenError,
} from '../../domain/dress-listing.errors';
import { ListingSlug } from '../../domain/listing-slug.value-object';
import { Styles } from '../../domain/style.value-object';
import { UpdateListingCommand } from './update-listing.command';

export type UpdateListingResult = Result<
  AggregateID,
  | ListingNotFoundError
  | ListingSlugLockedError
  | ListingSlugTakenError
  | ListingPhotoRequiredError
>;

/**
 * UpdateListing (spec §2). Every rejection has TWO referees — the entity/pre-check here and the
 * guarded write in the adapter — and both yield the same outcome:
 *   slug locked (R2)  entity  ⇄  `UPDATE … WHERE first_published_at IS NULL` → 0 rows
 *   slug taken  (R1)  pre-check ⇄ UNIQUE(slug)
 *   photo       (R3)  entity  ⇄  CHECK (published ⇒ ≥ 1 photo)
 */
@CommandHandler(UpdateListingCommand)
export class UpdateListingService
  implements ICommandHandler<UpdateListingCommand, UpdateListingResult>
{
  constructor(
    @Inject(DRESS_LISTING_REPOSITORY)
    private readonly listingRepo: DressListingRepositoryPort,
  ) {}

  async execute(command: UpdateListingCommand): Promise<UpdateListingResult> {
    const listing = await this.listingRepo.findOneById(command.listingId);
    if (!listing) return Err(new ListingNotFoundError());

    const now = new Date();
    let slugChanged = false;
    if (command.slug !== undefined) {
      const changed = listing.changeSlug(ListingSlug.create(command.slug), now);
      if (changed.isErr()) return Err(changed.unwrapErr());
      slugChanged = changed.unwrap();
      if (slugChanged && (await this.listingRepo.slugTaken(command.slug, listing.id))) {
        return Err(new ListingSlugTakenError(command.slug));
      }
    }

    const props = listing.getProps();
    const specs = command.specs ?? {};
    const updated = listing.updateContent(
      {
        name: command.name === undefined ? props.name : command.name.trim(),
        tagline: command.tagline ?? props.tagline,
        description: command.description ?? props.description,
        styles:
          command.styles === undefined ? props.styles : Styles.create(command.styles),
        retailPrice:
          command.retailPrice === undefined
            ? props.retailPrice
            : command.retailPrice === null
              ? null
              : Money.create(command.retailPrice),
        specs: {
          material: specs.material === undefined ? props.specs.material : specs.material,
          silhouette: specs.silhouette === undefined ? props.specs.silhouette : specs.silhouette,
          length: specs.length === undefined ? props.specs.length : specs.length,
          color: specs.color === undefined ? props.specs.color : specs.color,
          stylesText:
            specs.stylesText === undefined ? props.specs.stylesText : specs.stylesText,
        },
        photoUrls: command.photoUrls ?? props.photoUrls,
        isHot: command.isHot ?? props.isHot,
      },
      now,
    );
    if (updated.isErr()) return Err(updated.unwrapErr());

    try {
      await this.listingRepo.updateContent(listing, { slugChanged });
    } catch (error) {
      if (error instanceof ListingSlugLockedConflictError) {
        // A publish committed between our load and this write (R2 race).
        return Err(new ListingSlugLockedError());
      }
      if (error instanceof ListingSlugConflictError) {
        return Err(new ListingSlugTakenError(listing.slug.unpack(), error));
      }
      if (error instanceof ListingPhotoCheckError) {
        return Err(new ListingPhotoRequiredError(error));
      }
      if (error instanceof ListingGoneError) {
        return Err(new ListingNotFoundError(error));
      }
      throw error;
    }
    return Ok(listing.id);
  }
}
