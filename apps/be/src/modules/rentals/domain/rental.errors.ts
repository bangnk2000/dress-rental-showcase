import { ExceptionBase } from '../../../libs/exceptions';

export class RentalDressNotFoundError extends ExceptionBase {
  static readonly message = 'A dress in the rental does not exist';
  public readonly code = 'RENTALS.DRESS_NOT_FOUND';

  constructor(cause?: Error, metadata?: unknown) {
    super(RentalDressNotFoundError.message, cause, metadata);
  }
}

export class RentalDressRetiredError extends ExceptionBase {
  static readonly message = 'A dress in the rental is retired';
  public readonly code = 'RENTALS.DRESS_RETIRED';

  constructor(cause?: Error, metadata?: unknown) {
    super(RentalDressRetiredError.message, cause, metadata);
  }
}

export class DressUnavailableError extends ExceptionBase {
  static readonly message =
    'A dress is already booked for an overlapping period (including the cleaning buffer)';
  public readonly code = 'RENTALS.DRESS_UNAVAILABLE';

  constructor(cause?: Error, metadata?: unknown) {
    super(DressUnavailableError.message, cause, metadata);
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

  constructor(cause?: Error, metadata?: unknown) {
    super(RentalPickupNotAllowedError.message, cause, metadata);
  }
}

export class RentalReturnNotAllowedError extends ExceptionBase {
  static readonly message = 'Only a booked or handed-out rental can be returned';
  public readonly code = 'RENTALS.RETURN_NOT_ALLOWED';

  constructor(cause?: Error, metadata?: unknown) {
    super(RentalReturnNotAllowedError.message, cause, metadata);
  }
}
