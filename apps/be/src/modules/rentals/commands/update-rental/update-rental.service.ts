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
import { RentalStateChangedError } from '../../application/ports/rental-state-changed.error';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
  RentalNotFoundError,
  RentalUpdateNotAllowedError,
} from '../../domain/rental.errors';
import { UpdateRentalCommand } from './update-rental.command';

export type UpdateRentalResult = Result<
  AggregateID,
  | RentalNotFoundError
  | RentalUpdateNotAllowedError
  | RentalDressNotFoundError
  | RentalDressRetiredError
  | DressUnavailableError
>;

/**
 * FR-RENT-13 (docs/design/rentals/update-rental.md): the owner rewrites an OPEN rental. The flow
 * mirrors create-rental's preconditions on the NEW content — unknown dress, retired dress (added
 * ones only, §6.Q4), overlap incl. cleaning buffer (this rental's own rows excluded) — and then
 * writes under the rental's row lock so a concurrent close is never overwritten.
 */
@CommandHandler(UpdateRentalCommand)
export class UpdateRentalService
  implements ICommandHandler<UpdateRentalCommand, UpdateRentalResult>
{
  constructor(
    @Inject(RENTAL_REPOSITORY)
    private readonly rentalRepo: RentalRepositoryPort,
    @Inject(DRESS_LOOKUP)
    private readonly dressLookup: DressLookupPort,
    private readonly config: ConfigService,
  ) {}

  async execute(command: UpdateRentalCommand): Promise<UpdateRentalResult> {
    const rental = await this.rentalRepo.findOneById(command.rentalId);
    if (!rental) return Err(new RentalNotFoundError());
    // The lifecycle rule answers first (spec flow step 3) — a closed rental gets its own outcome
    // before any dress is looked up. The entity re-checks inside update(); this is the cheap exit.
    if (!rental.isOpen) return Err(new RentalUpdateNotAllowedError(rental.status));

    const period =
      command.startDate !== undefined || command.endDate !== undefined
        ? RentalPeriod.create(
            command.startDate ?? rental.period.start,
            command.endDate ?? rental.period.end,
          )
        : undefined;
    const bufferDays = this.config.getOrThrow<number>('CLEANING_BUFFER_DAYS');
    // Every item blocks the (new) period + the CURRENT buffer after an edit (§6.Q9), so the
    // availability question is asked about exactly that interval — for the CURRENT dresses too,
    // since a longer period moves their block as well.
    const blockedPeriod = (period ?? rental.period).extendEndByDays(bufferDays);

    const currentByDress = new Map(rental.items.map((item) => [item.dressId, item]));
    const wanted =
      command.items ?? rental.items.map((item) => ({ dressId: item.dressId, price: null }));
    const dressIds = wanted.map((item) => item.dressId);

    const snapshots = await this.dressLookup.findByIds(dressIds);
    const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const missing = dressIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return Err(new RentalDressNotFoundError(missing));
    }
    // A dress retired AFTER it was booked does not invalidate the rental it is on — only dresses
    // being ADDED must be on sale (§6.Q4). Otherwise fixing a phone number could fail because the
    // catalog moved.
    const retiredAdded = wanted
      .filter((item) => !currentByDress.has(item.dressId) && byId.get(item.dressId)!.retired)
      .map((item) => item.dressId);
    if (retiredAdded.length > 0) {
      return Err(new RentalDressRetiredError(retiredAdded));
    }

    // Availability precondition on the new interval, the rental's own rows excluded; the EXCLUDE
    // constraint backs it against races exactly as for create.
    const blocked = await this.rentalRepo.findBlockedDressIds(dressIds, blockedPeriod, {
      excludeRentalId: rental.id,
    });
    if (blocked.length > 0) {
      return Err(new DressUnavailableError(blocked));
    }

    // Item identity is the DRESS (§6.R3): a kept dress keeps its row id and its agreed price
    // unless a price is sent; an added dress gets a fresh id and the standard price unless a
    // price is sent. The entity reconciles by id and drops whatever is not listed.
    const items = wanted.map((input) => {
      const kept = currentByDress.get(input.dressId);
      return {
        id: kept?.id ?? this.rentalRepo.nextId(),
        dressId: input.dressId,
        price: Money.create(
          input.price ?? kept?.price.amount ?? byId.get(input.dressId)!.rentalPrice,
        ),
      };
    });

    const updated = rental.update(
      {
        customerName: command.customerName,
        customerPhone: command.customerPhone,
        period,
        notes: command.notes,
        discount:
          command.discountAmount !== undefined ? Money.create(command.discountAmount) : undefined,
        items: command.items !== undefined ? items : undefined,
      },
      new Date(),
      bufferDays,
    );
    if (updated.isErr()) return Err(updated.unwrapErr());

    try {
      await this.rentalRepo.saveUpdated(rental);
    } catch (error) {
      if (error instanceof RentalItemsOverlapError) {
        // A concurrent booking won the race and the EXCLUDE constraint refused this write. Same
        // rule as the pre-check above → same outcome (ADR 0001 §2); re-query so the payload names
        // the dresses that are actually taken now.
        const blockedNow = await this.rentalRepo.findBlockedDressIds(dressIds, blockedPeriod, {
          excludeRentalId: rental.id,
        });
        return Err(new DressUnavailableError(blockedNow.length > 0 ? blockedNow : dressIds, error));
      }
      if (error instanceof RentalStateChangedError) {
        // Staff closed the rental while the owner was editing: the pre-check's outcome, from
        // under the row lock. Nothing was written.
        return Err(new RentalUpdateNotAllowedError(error.currentStatus, error));
      }
      throw error;
    }
    return Ok(rental.id);
  }
}
