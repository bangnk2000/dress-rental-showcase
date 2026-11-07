import { ExceptionBase } from '../../../libs/exceptions';
import { RentalStatus } from './rental.types';

/**
 * RETURNED (never thrown) business rejections of the rentals context. Each one is rendered by its
 * controller as an outcome body with the code from docs/adr/0001-outcome-model-at-the-http-boundary.md
 * §3; the typed field on the error IS the outcome payload the FE needs to act.
 */
export class RentalDressNotFoundError extends ExceptionBase {
  static readonly message = 'A dress in the rental does not exist';
  public readonly code = 'RENTALS.DRESS_NOT_FOUND';

  constructor(
    readonly dressIds: string[],
    cause?: Error,
  ) {
    super(RentalDressNotFoundError.message, cause, { dressIds });
  }
}

export class RentalDressRetiredError extends ExceptionBase {
  static readonly message = 'A dress in the rental is retired';
  public readonly code = 'RENTALS.DRESS_RETIRED';

  constructor(
    readonly dressIds: string[],
    cause?: Error,
  ) {
    super(RentalDressRetiredError.message, cause, { dressIds });
  }
}

export class DressUnavailableError extends ExceptionBase {
  static readonly message =
    'A dress is already booked for an overlapping period (including the cleaning buffer)';
  public readonly code = 'RENTALS.DRESS_UNAVAILABLE';

  constructor(
    readonly dressIds: string[],
    cause?: Error,
  ) {
    super(DressUnavailableError.message, cause, { dressIds });
  }
}

export class RentalNotFoundError extends ExceptionBase {
  static readonly message = 'Rental not found';
  public readonly code = 'RENTALS.NOT_FOUND';

  constructor(cause?: Error, metadata?: unknown) {
    super(RentalNotFoundError.message, cause, metadata);
  }
}

export class RentalPickupNotAllowedError extends ExceptionBase {
  static readonly message = 'Only a booked rental can be handed out';
  public readonly code = 'RENTALS.PICKUP_NOT_ALLOWED';

  constructor(
    readonly currentStatus: RentalStatus,
    cause?: Error,
  ) {
    super(RentalPickupNotAllowedError.message, cause, { currentStatus });
  }
}

export class RentalReturnNotAllowedError extends ExceptionBase {
  static readonly message = 'Only a booked or handed-out rental can be returned';
  public readonly code = 'RENTALS.RETURN_NOT_ALLOWED';

  constructor(
    readonly currentStatus: RentalStatus,
    cause?: Error,
  ) {
    super(RentalReturnNotAllowedError.message, cause, { currentStatus });
  }
}

/** FR-RENT-09: staff may charge the suggested late fee or more — only the owner may charge less. */
export class LateFeeWaiverNotAllowedError extends ExceptionBase {
  static readonly message = 'Only the shop owner may charge less than the suggested late fee';
  public readonly code = 'RENTALS.LATE_FEE_WAIVER_NOT_ALLOWED';

  constructor(
    readonly suggestedLateFee: number,
    readonly submittedLateFee: number,
    cause?: Error,
  ) {
    super(LateFeeWaiverNotAllowedError.message, cause, { suggestedLateFee, submittedLateFee });
  }
}

/** FR-RENT-09: a waiver is auditable or it does not happen — the note carries the reason. */
export class LateFeeWaiverNoteRequiredError extends ExceptionBase {
  static readonly message = 'Charging less than the suggested late fee requires a note';
  public readonly code = 'RENTALS.LATE_FEE_WAIVER_NOTE_REQUIRED';

  constructor(
    readonly suggestedLateFee: number,
    readonly submittedLateFee: number,
    cause?: Error,
  ) {
    super(LateFeeWaiverNoteRequiredError.message, cause, { suggestedLateFee, submittedLateFee });
  }
}

/**
 * FR-RENT-13: only an OPEN rental (booked|out) can be edited — a returned or cancelled one is
 * history. Raised by the entity's pre-check AND by the repository's re-read under the row lock,
 * so a cancel that lands between load and save yields the same outcome.
 */
export class RentalUpdateNotAllowedError extends ExceptionBase {
  static readonly message = 'Only a booked or out rental can be edited';
  public readonly code = 'RENTALS.UPDATE_NOT_ALLOWED';

  constructor(
    readonly currentStatus: RentalStatus,
    cause?: Error,
  ) {
    super(RentalUpdateNotAllowedError.message, cause, { currentStatus });
  }
}

export class RentalCancelNotAllowedError extends ExceptionBase {
  static readonly message = 'A returned or cancelled rental cannot be cancelled';
  public readonly code = 'RENTALS.CANCEL_NOT_ALLOWED';

  constructor(
    readonly currentStatus: RentalStatus,
    cause?: Error,
  ) {
    super(RentalCancelNotAllowedError.message, cause, { currentStatus });
  }
}

/**
 * FR-RENT-10 §6.Q2, narrowed by rentals/cancel-with-refund (2026-11-07): an OUT rental with money
 * on file cannot be cancelled — the dress is with the customer, so the way out is the return flow.
 * A BOOKED rental with money cancels WITH refunds instead.
 */
export class RentalCancelHasPaymentsError extends ExceptionBase {
  static readonly message = 'The rental is out and has recorded money — settle it through the return flow';
  public readonly code = 'RENTALS.CANCEL_HAS_PAYMENTS';

  constructor(cause?: Error, metadata?: unknown) {
    super(RentalCancelHasPaymentsError.message, cause, metadata);
  }
}

/**
 * FR-PAY-02: the settlement was computed from a deposit total that no longer matches the ledger —
 * another device recorded a collection while the return dialog was open. Nothing is written; the
 * payload carries what IS on file so the screen can correct itself and ask for confirmation.
 */
export class ReturnDepositBasisChangedError extends ExceptionBase {
  static readonly message = 'The recorded deposit changed while the settlement was being prepared';
  public readonly code = 'RENTALS.DEPOSIT_BASIS_CHANGED';

  constructor(
    readonly collectedDeposit: number,
    cause?: Error,
  ) {
    super(ReturnDepositBasisChangedError.message, cause, { collectedDeposit });
  }
}

/**
 * rentals/cancel-with-refund R3: the refunds were computed from collected amounts that are not
 * what the ledger holds under the row lock (or the caller sent no basis while money is on file).
 * Nothing is written; the payload is what IS on file so the dialog re-derives its refunds.
 */
export class CancelBasisChangedError extends ExceptionBase {
  static readonly message = 'The money on file changed while the cancel was being prepared';
  public readonly code = 'RENTALS.CANCEL_BASIS_CHANGED';

  constructor(
    readonly collectedDeposit: number,
    readonly collectedRentalFee: number,
    cause?: Error,
  ) {
    super(CancelBasisChangedError.message, cause, { collectedDeposit, collectedRentalFee });
  }
}

export type RefundableKind = 'deposit' | 'rental_fee';

/** rentals/cancel-with-refund R2: a refund never exceeds what was collected of the same kind. */
export class RefundExceedsCollectedError extends ExceptionBase {
  static readonly message = 'A refund cannot exceed the amount collected';
  public readonly code = 'RENTALS.REFUND_EXCEEDS_COLLECTED';

  constructor(
    readonly kind: RefundableKind,
    readonly collected: number,
    readonly submitted: number,
    cause?: Error,
  ) {
    super(RefundExceedsCollectedError.message, cause, { kind, collected, submitted });
  }
}

/** rentals/cancel-with-refund §6.Q3: keeping any of the customer's money is the owner's call. */
export class CancelRetentionNotAllowedError extends ExceptionBase {
  static readonly message = 'Only the shop owner may keep money when cancelling';
  public readonly code = 'RENTALS.CANCEL_RETENTION_NOT_ALLOWED';

  constructor(
    readonly retainedAmount: number,
    cause?: Error,
  ) {
    super(CancelRetentionNotAllowedError.message, cause, { retainedAmount });
  }
}

/** rentals/cancel-with-refund §6.Q3: money kept on a cancel must carry a reason. */
export class CancelRetentionNoteRequiredError extends ExceptionBase {
  static readonly message = 'Keeping money when cancelling requires a note';
  public readonly code = 'RENTALS.CANCEL_RETENTION_NOTE_REQUIRED';

  constructor(
    readonly retainedAmount: number,
    cause?: Error,
  ) {
    super(CancelRetentionNoteRequiredError.message, cause, { retainedAmount });
  }
}
