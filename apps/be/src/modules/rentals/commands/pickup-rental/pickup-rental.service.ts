import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { RentalStateChangedError } from '../../application/ports/rental-state-changed.error';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import {
  RentalNotFoundError,
  RentalPickupNotAllowedError,
} from '../../domain/rental.errors';
import { PickupRentalCommand } from './pickup-rental.command';

export type PickupRentalResult = Result<
  AggregateID,
  RentalNotFoundError | RentalPickupNotAllowedError
>;

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
      await this.rentalRepo.savePickedUp(rental);
    } catch (error) {
      if (error instanceof RentalStateChangedError) {
        // Cancelled between load and lock: the same rule the aggregate's pre-check enforces.
        return Err(new RentalPickupNotAllowedError(error.currentStatus, error));
      }
      throw error;
    }
    return Ok(rental.id);
  }
}
