import { ExceptionBase } from '../../../libs/exceptions';
import { CollectionKind } from './payment.types';

/**
 * RETURNED (never thrown) business rejections of the payments context. Each is rendered by its
 * controller as an outcome body with the code from
 * docs/adr/0001-outcome-model-at-the-http-boundary.md §3; the typed fields ARE the payload the FE
 * needs to act (docs/design/payments/record-collection.md §2).
 */
export class CollectionRentalNotFoundError extends ExceptionBase {
  static readonly message = 'Rental not found';
  public readonly code = 'PAYMENTS.RENTAL_NOT_FOUND';

  constructor(cause?: Error) {
    super(CollectionRentalNotFoundError.message, cause);
  }
}

/** R4: money is recorded on an OPEN rental (booked|out) — a closed one is a mistyped rental. */
export class RentalClosedError extends ExceptionBase {
  static readonly message = 'Money can only be recorded on a booked or handed-out rental';
  public readonly code = 'PAYMENTS.RENTAL_CLOSED';

  constructor(
    readonly currentStatus: 'returned' | 'cancelled',
    cause?: Error,
  ) {
    super(RentalClosedError.message, cause, { currentStatus });
  }
}

/** The command was called with neither amount — valid fields, invalid use case (§2). */
export class NothingToRecordError extends ExceptionBase {
  static readonly message = 'No amount to record';
  public readonly code = 'PAYMENTS.NOTHING_TO_RECORD';

  constructor(cause?: Error) {
    super(NothingToRecordError.message, cause);
  }
}

/**
 * R3: one deposit and one rental fee per rental. Raised by the application pre-check AND by the
 * repository when the partial UNIQUE index refuses a racing write — same rule, same code
 * (ADR 0001 §2), with the amount that is actually on file.
 */
export class CollectionAlreadyRecordedError extends ExceptionBase {
  static readonly message = 'This amount was already recorded for the rental';
  public readonly code = 'PAYMENTS.ALREADY_RECORDED';

  constructor(
    readonly kind: CollectionKind,
    readonly recordedAmount: number,
    cause?: Error,
  ) {
    super(CollectionAlreadyRecordedError.message, cause, { kind, recordedAmount });
  }
}
