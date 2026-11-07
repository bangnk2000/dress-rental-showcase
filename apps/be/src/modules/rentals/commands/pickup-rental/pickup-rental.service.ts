import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  DepositMissingError,
  DepositOnFileError,
} from '../../application/ports/pickup-deposit.error';
import { RentalStateChangedError } from '../../application/ports/rental-state-changed.error';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import {
  DepositNotCollectedError,
  PickupDepositAlreadyRecordedError,
  RentalNotFoundError,
  RentalPickupNotAllowedError,
} from '../../domain/rental.errors';
import { PickupRentalCommand } from './pickup-rental.command';

export type PickupRentalResult = Result<
  AggregateID,
  | RentalNotFoundError
  | RentalPickupNotAllowedError
  | DepositNotCollectedError
  | PickupDepositAlreadyRecordedError
>;

/**
 * FR-RENT-04 + FR-RENT-14 (docs/design/rentals/deposit-at-pickup.md): booked → out, and only with
 * a deposit on file or collected right now. The deposit rules are judged by the repository under
 * the rental's row lock — the ledger can change until the very write.
 */
@CommandHandler(PickupRentalCommand)
export class PickupRentalService
  implements ICommandHandler<PickupRentalCommand, PickupRentalResult>
{
  constructor(
    @Inject(RENTAL_REPOSITORY)
    private readonly rentalRepo: RentalRepositoryPort,
  ) {}

  async execute(command: PickupRentalCommand): Promise<PickupRentalResult> {
    const rental = await this.rentalRepo.findOneById(command.rentalId);
    if (!rental) return Err(new RentalNotFoundError());

    const pickedUp = rental.markPickedUp(new Date());
    if (pickedUp.isErr()) return Err(pickedUp.unwrapErr());

    try {
      await this.rentalRepo.savePickedUp(rental, command.depositCollected);
    } catch (error) {
      if (error instanceof RentalStateChangedError) {
        // Cancelled between load and lock: the same rule the aggregate's pre-check enforces.
        return Err(new RentalPickupNotAllowedError(error.currentStatus, error));
      }
      if (error instanceof DepositMissingError) {
        return Err(new DepositNotCollectedError(error));
      }
      if (error instanceof DepositOnFileError) {
        return Err(new PickupDepositAlreadyRecordedError(error.recordedAmount, error));
      }
      throw error;
    }
    return Ok(rental.id);
  }
}
