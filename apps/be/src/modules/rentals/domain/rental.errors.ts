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
 * FR-RENT-10 §6.Q2: cancelling is for rentals whose ledger is EMPTY — recorded money must leave
 * through the return flow, where the refund is written down, never be orphaned by a cancel.
 */
export class RentalCancelHasPaymentsError extends ExceptionBase {
  static readonly message = 'The rental has recorded money — settle it through the return flow';
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
