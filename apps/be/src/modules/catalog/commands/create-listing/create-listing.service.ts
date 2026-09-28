import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import {
  DRESS_LISTING_REPOSITORY,
  DressListingRepositoryPort,
} from '../../application/ports/dress-listing.repository.port';
import { ListingSlugConflictError } from '../../application/ports/listing-write-conflict.errors';
import { DressListingEntity } from '../../domain/dress-listing.entity';
import { ListingSlugTakenError } from '../../domain/dress-listing.errors';
import { ListingSlug } from '../../domain/listing-slug.value-object';
import { Occasions } from '../../domain/occasion.value-object';
import { CreateListingCommand } from './create-listing.command';

export type CreateListingResult = Result<AggregateID, ListingSlugTakenError>;

/**
 * CreateListing (spec §2): a new DRAFT listing. Slug format / occasions / price are VOs (throw →
 * 400); a taken slug is the only business rejection, from the pre-check OR the UNIQUE race.
 */
@CommandHandler(CreateListingCommand)
export class CreateListingService
  implements ICommandHandler<CreateListingCommand, CreateListingResult>
{
  constructor(
    @Inject(DRESS_LISTING_REPOSITORY)
    private readonly listingRepo: DressListingRepositoryPort,
  ) {}

  async execute(command: CreateListingCommand): Promise<CreateListingResult> {
    const slug =
      command.slug === undefined
        ? ListingSlug.fromName(command.name)
        : ListingSlug.create(command.slug);

    const listing = DressListingEntity.create(
      {
        slug,
        name: command.name.trim(),
        tagline: command.tagline,
        description: command.description,
        occasions: Occasions.create(command.occasions),
        retailPrice: command.retailPrice === null ? null : Money.create(command.retailPrice),
        specs: { ...command.specs },
        photoUrls: [...command.photoUrls],
        isHot: command.isHot,
      },
      this.listingRepo.nextId(),
      new Date(),
    );

    if (await this.listingRepo.slugTaken(slug.unpack())) {
      return Err(new ListingSlugTakenError(slug.unpack()));
    }
    try {
      await this.listingRepo.insert(listing);
    } catch (error) {
      if (error instanceof ListingSlugConflictError) {
        // Lost the race past the pre-check: same rule, same outcome (ADR 0001 §3).
        return Err(new ListingSlugTakenError(slug.unpack(), error));
      }
      throw error;
    }
    return Ok(listing.id);
  }
}
