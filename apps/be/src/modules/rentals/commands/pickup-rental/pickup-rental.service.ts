import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
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

    await this.rentalRepo.save(rental);
    return Ok(rental.id);
  }
}
