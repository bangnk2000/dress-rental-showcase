import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { LedgerNotEmptyError } from '../../application/ports/ledger-not-empty.error';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import {
  RentalCancelHasPaymentsError,
  RentalCancelNotAllowedError,
  RentalNotFoundError,
} from '../../domain/rental.errors';
import { CancelRentalCommand } from './cancel-rental.command';

export type CancelRentalResult = Result<
  AggregateID,
  RentalNotFoundError | RentalCancelNotAllowedError | RentalCancelHasPaymentsError
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

    try {
      // EVERY cancel goes through the empty-ledger guard, not just born-out rentals: since
      // payments/record-collection, a BOOKED rental can hold a deposit too — money on file must
      // be settled through return, whatever the status. Checked under the rental's row lock.
      await this.rentalRepo.saveCancelled(rental);
    } catch (error) {
      if (error instanceof LedgerNotEmptyError) {
        return Err(new RentalCancelHasPaymentsError(error));
      }
      throw error;
    }
    return Ok(rental.id);
  }
}
