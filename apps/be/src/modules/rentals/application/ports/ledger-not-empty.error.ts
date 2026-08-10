import { ExceptionBase } from '../../../../libs/exceptions';

/**
 * Part of the RentalRepositoryPort CONTRACT for `saveCancelled`: the rental's ledger holds at
 * least one money row, checked under the rental's row lock so a collection cannot slip in
 * between the service's decision and the status flip. Money on file must leave through the
 * return flow, never be orphaned by a cancel (FR-RENT-10 §6.Q2).
 *
 * Technical signal, not a business rejection — `cancel-rental.service.ts` converts it into the
 * `rejected_cancel_has_payments` outcome.
 */
export class LedgerNotEmptyError extends ExceptionBase {
  static readonly message = 'The rental has recorded money movements';
  public readonly code = 'RENTALS.LEDGER_NOT_EMPTY';

  constructor(cause?: Error, metadata?: unknown) {
    super(LedgerNotEmptyError.message, cause, metadata);
  }
}
