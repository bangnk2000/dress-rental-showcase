import { ExceptionBase } from '../../../libs/exceptions';

export class DressCodeAlreadyExistsError extends ExceptionBase {
  static readonly message = 'A dress with this code already exists';
  public readonly code = 'CATALOG.DRESS_CODE_ALREADY_EXISTS';

  constructor(cause?: Error, metadata?: unknown) {
    super(DressCodeAlreadyExistsError.message, cause, metadata);
  }
}

export class DressNotFoundError extends ExceptionBase {
  static readonly message = 'Dress not found';
  public readonly code = 'CATALOG.DRESS_NOT_FOUND';

  constructor(cause?: Error, metadata?: unknown) {
    super(DressNotFoundError.message, cause, metadata);
  }
}

export class DressAlreadyRetiredError extends ExceptionBase {
  static readonly message = 'Dress is already retired';
  public readonly code = 'CATALOG.DRESS_ALREADY_RETIRED';

  constructor(cause?: Error, metadata?: unknown) {
    super(DressAlreadyRetiredError.message, cause, metadata);
  }
}
