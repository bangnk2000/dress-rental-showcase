import { ExceptionBase } from './exception.base';

export class ArgumentInvalidException extends ExceptionBase {
  readonly code = 'GENERIC.ARGUMENT_INVALID';
}

export class NotFoundException extends ExceptionBase {
  readonly code = 'GENERIC.NOT_FOUND';
}

export class ConflictException extends ExceptionBase {
  readonly code = 'GENERIC.CONFLICT';
}

export class UnauthorizedException extends ExceptionBase {
  readonly code = 'GENERIC.UNAUTHORIZED';
}

export class ForbiddenException extends ExceptionBase {
  readonly code = 'GENERIC.FORBIDDEN';
}
