import { ExceptionBase } from '../../../../libs/exceptions';

/**
 * Part of the RentalRepositoryPort CONTRACT for `saveReturned`: the deposit the caller computed its
 * refund from is no longer what the ledger holds, checked under the rental's row lock so a
 * collection cannot slip in between.
 *
 * It is a technical signal ("the precondition failed at write time"), not a business rejection.
 * `return-rental.service.ts` converts it into the outcome the FE renders, carrying the amount that
 * IS on file so the screen can correct itself.
 */
export class DepositBasisChangedError extends ExceptionBase {
  static readonly message = 'The recorded deposit changed before the settlement was written';
  public readonly code = 'RENTALS.DEPOSIT_BASIS_CHANGED';

  constructor(
    readonly collectedDeposit: number,
    cause?: Error,
  ) {
    super(DepositBasisChangedError.message, cause, { collectedDeposit });
  }
}
