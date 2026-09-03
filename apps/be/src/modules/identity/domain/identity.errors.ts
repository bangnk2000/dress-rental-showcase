import { ExceptionBase } from '../../../libs/exceptions';

/**
 * RETURNED (never thrown) business rejections of the identity context — rendered as outcome
 * bodies per docs/adr/0001-outcome-model-at-the-http-boundary.md §3.
 */
export class InvalidCredentialsError extends ExceptionBase {
  static readonly message = 'Invalid credentials';
  public readonly code = 'IDENTITY.INVALID_CREDENTIALS';

  constructor(cause?: Error, metadata?: unknown) {
    super(InvalidCredentialsError.message, cause, metadata);
  }
}

/**
 * Correct credentials, locked account. Deliberately DISTINCT from InvalidCredentialsError: a
 * locked person should learn they are locked, not doubt their typing (spec §6.Q4 — an internal
 * tool has no account-enumeration adversary). Only reachable AFTER the password matched.
 */
export class AccountLockedError extends ExceptionBase {
  static readonly message = 'Account is locked';
  public readonly code = 'IDENTITY.ACCOUNT_LOCKED';

  constructor(cause?: Error, metadata?: unknown) {
    super(AccountLockedError.message, cause, metadata);
  }
}

export class UsernameAlreadyExistsError extends ExceptionBase {
  static readonly message = 'A user with this username already exists';
  public readonly code = 'IDENTITY.USERNAME_ALREADY_EXISTS';

  constructor(
    readonly username: string,
    cause?: Error,
  ) {
    super(UsernameAlreadyExistsError.message, cause, { username });
  }
}

export class UserNotFoundError extends ExceptionBase {
  static readonly message = 'User not found';
  public readonly code = 'IDENTITY.USER_NOT_FOUND';

  constructor(cause?: Error, metadata?: unknown) {
    super(UserNotFoundError.message, cause, metadata);
  }
}

export class UserAlreadyInactiveError extends ExceptionBase {
  static readonly message = 'User is already locked';
  public readonly code = 'IDENTITY.USER_ALREADY_INACTIVE';

  constructor(cause?: Error, metadata?: unknown) {
    super(UserAlreadyInactiveError.message, cause, metadata);
  }
}

export class UserAlreadyActiveError extends ExceptionBase {
  static readonly message = 'User is already active';
  public readonly code = 'IDENTITY.USER_ALREADY_ACTIVE';

  constructor(cause?: Error, metadata?: unknown) {
    super(UserAlreadyActiveError.message, cause, metadata);
  }
}

/**
 * The owner locking their own account would leave nobody able to unlock anything — refused as a
 * rule, not left to operational luck.
 */
export class CannotDeactivateSelfError extends ExceptionBase {
  static readonly message = 'You cannot lock your own account';
  public readonly code = 'IDENTITY.CANNOT_DEACTIVATE_SELF';

  constructor(cause?: Error, metadata?: unknown) {
    super(CannotDeactivateSelfError.message, cause, metadata);
  }
}
