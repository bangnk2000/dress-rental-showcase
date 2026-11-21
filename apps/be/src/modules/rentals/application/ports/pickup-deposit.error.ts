import { ExceptionBase } from '../../../../libs/exceptions';

/**
 * Part of the RentalRepositoryPort CONTRACT for `savePickedUp` (FR-RENT-14): read under the
 * rental's row lock, the ledger holds no deposit and the pickup brought none. Nothing is written.
 * Technical signal — `pickup-rental.service.ts` turns it into `rejected_deposit_not_collected`.
 */
export class DepositMissingError extends ExceptionBase {
  static readonly message = 'No deposit on file and none collected at pickup';
  public readonly code = 'RENTALS.DEPOSIT_MISSING';

  constructor(cause?: Error, metadata?: unknown) {
    super(DepositMissingError.message, cause, metadata);
  }
}

/**
 * Part of the RentalRepositoryPort CONTRACT for `savePickedUp` (FR-RENT-14): the pickup brought a
 * deposit but the ledger already holds one (another device recorded it meanwhile). Nothing is
 * written; `recordedAmount` is what IS on file. Becomes `rejected_deposit_already_recorded`.
 */
export class DepositOnFileError extends ExceptionBase {
  static readonly message = 'A deposit is already on file';
  public readonly code = 'RENTALS.DEPOSIT_ON_FILE';

  constructor(
    readonly recordedAmount: number,
    cause?: Error,
  ) {
    super(DepositOnFileError.message, cause, { recordedAmount });
  }
}
