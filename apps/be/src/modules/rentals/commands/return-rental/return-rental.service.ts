import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import {
  PAYMENT_RECORDER,
  PaymentRecorderPort,
  SettlementPayment,
} from '../../application/ports/payment-recorder.port';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import {
  RentalNotFoundError,
  RentalReturnNotAllowedError,
} from '../../domain/rental.errors';
import { ReturnRentalCommand } from './return-rental.command';

export type ReturnRentalResult = Result<
  AggregateID,
  RentalNotFoundError | RentalReturnNotAllowedError
>;

@CommandHandler(ReturnRentalCommand)
export class ReturnRentalService
  implements ICommandHandler<ReturnRentalCommand, ReturnRentalResult>
{
  constructor(
    @Inject(RENTAL_REPOSITORY)
    private readonly rentalRepo: RentalRepositoryPort,
    @Inject(PAYMENT_RECORDER)
    private readonly paymentRecorder: PaymentRecorderPort,
  ) {}

  /**
   * The items keep blocking through the cleaning buffer — that IS the derived
   * "cleaning" state; the dress becomes "available" when the buffer passes.
   * Settlement rows land AFTER the status flip: if recording fails the rental
   * is already returned and the fees are re-entered by hand (accepted MVP
   * trade-off — the reverse order could book fees on a never-returned rental).
   */
  async execute(command: ReturnRentalCommand): Promise<ReturnRentalResult> {
    const rental = await this.rentalRepo.findOneById(command.rentalId);
    if (!rental) return Err(new RentalNotFoundError());

    const returned = rental.markReturned(new Date());
    if (returned.isErr()) return Err(returned.unwrapErr());

    await this.rentalRepo.save(rental);

    const movements: SettlementPayment[] = [
      { kind: 'late_fee' as const, amount: command.lateFee },
      { kind: 'damage_fee' as const, amount: command.damageFee },
      { kind: 'deposit_refund' as const, amount: command.depositRefund },
    ]
      .filter((movement): movement is { kind: SettlementPayment['kind']; amount: number } =>
        movement.amount !== null && movement.amount > 0,
      )
      .map((movement) => ({ ...movement, note: command.note }));
    await this.paymentRecorder.recordSettlement(rental.id, movements);

    return Ok(rental.id);
  }
}
