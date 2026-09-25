import { ExceptionBase } from './exception.base';

/**
 * 400. `code` is widened to `string` so a context can subclass it with its own stable envelope
 * code (e.g. `PHOTO.UNSUPPORTED_TYPE`) and still be rendered as 400 by the filter.
 */
export class ArgumentInvalidException extends ExceptionBase {
  readonly code: string = 'GENERIC.ARGUMENT_INVALID';
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

/** 503 — an optional dependency is not configured / not reachable. Subclass for a named code. */
export class ServiceUnavailableException extends ExceptionBase {
  readonly code: string = 'GENERIC.SERVICE_UNAVAILABLE';
}
