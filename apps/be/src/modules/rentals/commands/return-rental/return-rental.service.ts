import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { shopToday } from '../../../../libs/utils/date';
import {
  PAYMENT_RECORDER,
  PaymentRecorderPort,
  SettlementPayment,
} from '../../application/ports/payment-recorder.port';
import { DepositBasisChangedError } from '../../application/ports/deposit-basis-changed.error';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import {
  LateFeeWaiverNotAllowedError,
  LateFeeWaiverNoteRequiredError,
  RentalNotFoundError,
  RentalReturnNotAllowedError,
  ReturnDepositBasisChangedError,
} from '../../domain/rental.errors';
import { ReturnRentalCommand } from './return-rental.command';

export type ReturnRentalResult = Result<
  AggregateID,
  | RentalNotFoundError
  | RentalReturnNotAllowedError
  | LateFeeWaiverNotAllowedError
  | LateFeeWaiverNoteRequiredError
  | ReturnDepositBasisChangedError
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
    private readonly config: ConfigService,
  ) {}

  /**
   * The items keep blocking through the cleaning buffer — that IS the derived
   * "cleaning" state; the dress becomes "available" when the buffer passes.
   * Settlement rows land AFTER the status flip: if recording fails the rental
   * is already returned and the fees are re-entered by hand (accepted MVP
   * trade-off — the reverse order could book fees on a never-returned rental).
   *
   * Late fee (FR-RENT-09, docs/design/rentals/settle-late-fee.md): the server owns the number.
   * `lateFee` omitted = charge the suggested amount; more than suggested is a private arrangement
   * and allowed; LESS is a waiver — owner-only, and it must carry a reason.
   */
  async execute(command: ReturnRentalCommand): Promise<ReturnRentalResult> {
    const rental = await this.rentalRepo.findOneById(command.rentalId);
    if (!rental) return Err(new RentalNotFoundError());

    // Spec flow order: the lifecycle rule decides first, so a rental that is already returned
    // answers rejected_return_not_allowed rather than a fee complaint. Nothing is persisted until
    // save(), so returning Err below leaves the rental untouched.
    const returned = rental.markReturned(new Date());
    if (returned.isErr()) return Err(returned.unwrapErr());

    const quote = rental.lateFeeQuote(
      shopToday(),
      this.config.getOrThrow<number>('LATE_FEE_PER_DRESS_PER_DAY'),
    );
    const chargedLateFee = command.lateFee ?? quote.suggestedLateFee;

    if (chargedLateFee < quote.suggestedLateFee) {
      if (command.actorRole !== 'owner') {
        return Err(new LateFeeWaiverNotAllowedError(quote.suggestedLateFee, chargedLateFee));
      }
      if (!command.note?.trim()) {
        return Err(new LateFeeWaiverNoteRequiredError(quote.suggestedLateFee, chargedLateFee));
      }
    }

    // The refund the caller computed rests on the deposit ON FILE, and a collection can commit
    // right up to this write. The check travels INTO the write transaction, under the rental's row
    // lock, so the two operations take turns instead of overlapping (FR-PAY-02).
    try {
      await this.rentalRepo.saveReturned(rental, command.expectedDepositCollected);
    } catch (error) {
      if (error instanceof DepositBasisChangedError) {
        return Err(new ReturnDepositBasisChangedError(error.collectedDeposit, error));
      }
      throw error;
    }

    const movements: SettlementPayment[] = [
      { kind: 'late_fee' as const, amount: chargedLateFee },
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
