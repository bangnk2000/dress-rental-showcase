import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import {
  RentalCancelNotAllowedError,
  RentalNotFoundError,
} from '../../domain/rental.errors';
import { CancelRentalCommand } from './cancel-rental.command';

export type CancelRentalResult = Result<
  AggregateID,
  RentalNotFoundError | RentalCancelNotAllowedError
>;

@CommandHandler(CancelRentalCommand)
export class CancelRentalService
  implements ICommandHandler<CancelRentalCommand, CancelRentalResult>
{
  constructor(
    @Inject(RENTAL_REPOSITORY)
    private readonly rentalRepo: RentalRepositoryPort,
  ) {}

  async execute(command: CancelRentalCommand): Promise<CancelRentalResult> {
    const rental = await this.rentalRepo.findOneById(command.rentalId);
    if (!rental) return Err(new RentalNotFoundError());

    const cancelled = rental.cancel(new Date());
    if (cancelled.isErr()) return Err(cancelled.unwrapErr());

    await this.rentalRepo.save(rental);
    return Ok(rental.id);
  }
}
