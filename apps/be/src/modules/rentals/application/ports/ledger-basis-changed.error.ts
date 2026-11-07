import { ExceptionBase } from '../../../../libs/exceptions';

/**
 * Part of the RentalRepositoryPort CONTRACT for `saveCancelled`: the collected amounts the caller
 * computed its refunds from are not what the ledger holds under the rental's row lock — or money
 * is on file and the caller made no claim at all. Nothing is written.
 *
 * Technical signal, not a business rejection — `cancel-rental.service.ts` converts it into the
 * `rejected_cancel_basis_changed` outcome, carrying the amounts that ARE on file.
 */
export class LedgerBasisChangedError extends ExceptionBase {
  static readonly message = 'The collected amounts changed before the cancel was written';
  public readonly code = 'RENTALS.LEDGER_BASIS_CHANGED';

  constructor(
    readonly collectedDeposit: number,
    readonly collectedRentalFee: number,
    cause?: Error,
  ) {
    super(LedgerBasisChangedError.message, cause, { collectedDeposit, collectedRentalFee });
  }
}
