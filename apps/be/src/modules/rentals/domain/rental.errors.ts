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
