import { ExceptionBase } from '../../../libs/exceptions';

export class InvalidCredentialsError extends ExceptionBase {
  static readonly message = 'Invalid credentials';
  public readonly code = 'IDENTITY.INVALID_CREDENTIALS';

  constructor(cause?: Error, metadata?: unknown) {
    super(InvalidCredentialsError.message, cause, metadata);
  }
}
