import { ExceptionBase } from '../../../../libs/exceptions';

/**
 * Part of the RentalRepositoryPort CONTRACT for `saveCancelled`: the rental is OUT and its ledger
 * holds at least one money row, checked under the rental's row lock so a collection cannot slip
 * in between the service's decision and the status flip. The dress is with the customer, so the
 * money leaves through the return flow (FR-RENT-10 §6.Q2, narrowed by cancel-with-refund §6.Q1).
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
