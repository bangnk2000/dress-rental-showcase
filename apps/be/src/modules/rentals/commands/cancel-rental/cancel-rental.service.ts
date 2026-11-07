import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Err, Ok, Result } from 'oxide.ts';
import { AggregateID } from '../../../../libs/ddd/entity.base';
import { LedgerBasisChangedError } from '../../application/ports/ledger-basis-changed.error';
import { LedgerNotEmptyError } from '../../application/ports/ledger-not-empty.error';
import { RentalStateChangedError } from '../../application/ports/rental-state-changed.error';
import {
  CancelSettlement,
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import {
  CancelBasisChangedError,
  CancelRetentionNotAllowedError,
  CancelRetentionNoteRequiredError,
  RefundExceedsCollectedError,
  RentalCancelHasPaymentsError,
  RentalCancelNotAllowedError,
  RentalNotFoundError,
} from '../../domain/rental.errors';
import { CancelRentalCommand } from './cancel-rental.command';

export type CancelRentalResult = Result<
  AggregateID,
  | RentalNotFoundError
  | RentalCancelNotAllowedError
  | RentalCancelHasPaymentsError
  | CancelBasisChangedError
  | RefundExceedsCollectedError
  | CancelRetentionNotAllowedError
  | CancelRetentionNoteRequiredError
>;

type SettlementResult = Result<
  CancelSettlement | null,
  RefundExceedsCollectedError | CancelRetentionNotAllowedError | CancelRetentionNoteRequiredError
>;

/**
 * FR-RENT-06 as amended by rentals/cancel-with-refund (docs/design/rentals/cancel-with-refund.md).
 * The refund rules are judged against the caller's CLAIMED basis here; the repository then proves
 * that claim equals the ledger under the rental's row lock, so judging against it is judging
 * against the ledger.
 */
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

    // The reason lives on the rental, not only on refund rows: when everything is kept there is
    // no row to carry it (PR #38 review C2).
    const cancelled = rental.cancel(new Date(), command.note?.trim() || null);
    if (cancelled.isErr()) return Err(cancelled.unwrapErr());

    const settlement = this.settlementFrom(command);
    if (settlement.isErr()) return Err(settlement.unwrapErr());

    try {
      await this.rentalRepo.saveCancelled(rental, settlement.unwrap());
    } catch (error) {
      if (error instanceof LedgerNotEmptyError) {
        return Err(new RentalCancelHasPaymentsError(error));
      }
      if (error instanceof LedgerBasisChangedError) {
        return Err(
          new CancelBasisChangedError(error.collectedDeposit, error.collectedRentalFee, error),
        );
      }
      if (error instanceof RentalStateChangedError) {
        // Closed between load and lock: the same rule the aggregate's pre-check enforces.
        return Err(new RentalCancelNotAllowedError(error.currentStatus, error));
      }
      throw error;
    }
    return Ok(rental.id);
  }

  private settlementFrom(command: CancelRentalCommand): SettlementResult {
    if (command.expectedDepositCollected === null && command.expectedRentalFeeCollected === null) {
      return Ok(null);
    }
    const collected = {
      deposit: command.expectedDepositCollected ?? 0,
      rental_fee: command.expectedRentalFeeCollected ?? 0,
    };
    const refund = {
      deposit: command.depositRefund ?? 0,
      rental_fee: command.rentalFeeRefund ?? 0,
    };

    for (const kind of ['deposit', 'rental_fee'] as const) {
      if (refund[kind] > collected[kind]) {
        return Err(new RefundExceedsCollectedError(kind, collected[kind], refund[kind]));
      }
    }

    const retained =
      collected.deposit - refund.deposit + (collected.rental_fee - refund.rental_fee);
    if (retained > 0) {
      if (command.actorRole !== 'owner') return Err(new CancelRetentionNotAllowedError(retained));
      if (!command.note?.trim()) return Err(new CancelRetentionNoteRequiredError(retained));
    }

    return Ok({
      expectedDepositCollected: collected.deposit,
      expectedRentalFeeCollected: collected.rental_fee,
      refunds: [
        { kind: 'deposit_refund' as const, amount: refund.deposit, note: command.note },
        { kind: 'rental_fee_refund' as const, amount: refund.rental_fee, note: command.note },
      ].filter((row) => row.amount > 0),
    });
  }
}
