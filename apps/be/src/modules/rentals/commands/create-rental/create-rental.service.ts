import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import {
  DRESS_LOOKUP,
  DressLookupPort,
} from '../../application/ports/dress-lookup.port';
import { RentalItemsOverlapError } from '../../application/ports/rental-overlap.error';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
} from '../../domain/rental.errors';
import { CreateRentalCommand } from './create-rental.command';

export type CreateRentalResult = Result<
  AggregateID,
  RentalDressNotFoundError | RentalDressRetiredError | DressUnavailableError
>;

@CommandHandler(CreateRentalCommand)
export class CreateRentalService
  implements ICommandHandler<CreateRentalCommand, CreateRentalResult>
{
  constructor(
    @Inject(RENTAL_REPOSITORY)
    private readonly rentalRepo: RentalRepositoryPort,
    @Inject(DRESS_LOOKUP)
    private readonly dressLookup: DressLookupPort,
    private readonly config: ConfigService,
  ) {}

  async execute(command: CreateRentalCommand): Promise<CreateRentalResult> {
    const period = RentalPeriod.create(command.startDate, command.endDate);
    const bufferDays = this.config.getOrThrow<number>('CLEANING_BUFFER_DAYS');
    const blockedPeriod = period.extendEndByDays(bufferDays);
    const dressIds = command.items.map((item) => item.dressId);

    const snapshots = await this.dressLookup.findByIds(dressIds);
    const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const missing = dressIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return Err(new RentalDressNotFoundError(missing));
    }
    const retired = snapshots.filter((s) => s.retired).map((s) => s.id);
    if (retired.length > 0) {
      return Err(new RentalDressRetiredError(retired));
    }

    // Availability precondition; the DB EXCLUDE constraint backs it against races.
    const blocked = await this.rentalRepo.findBlockedDressIds(dressIds, blockedPeriod);
    if (blocked.length > 0) {
      return Err(new DressUnavailableError(blocked));
    }

    const rental = RentalEntity.create(
      {
        customerName: command.customerName,
        customerPhone: command.customerPhone,
        period,
        notes: command.notes,
        items: command.items.map((item) => ({
          id: this.rentalRepo.nextId(),
          dressId: item.dressId,
          // Item price is the agreement with THIS customer; defaults to the standard price.
          price: Money.create(item.price ?? byId.get(item.dressId)!.rentalPrice),
        })),
      },
      this.rentalRepo.nextId(),
      new Date(),
      bufferDays,
    );

    try {
      await this.rentalRepo.insert(rental);
    } catch (error) {
      if (error instanceof RentalItemsOverlapError) {
        // A concurrent request won the race and the EXCLUDE constraint refused this write. Same
        // business rule as the pre-check above, so it MUST be the same outcome (ADR 0001 §2) —
        // re-query so the payload names the dresses that are actually taken now.
        const blockedNow = await this.rentalRepo.findBlockedDressIds(dressIds, blockedPeriod);
        return Err(new DressUnavailableError(blockedNow.length > 0 ? blockedNow : dressIds, error));
      }
      throw error;
    }
    return Ok(rental.id);
  }
}
