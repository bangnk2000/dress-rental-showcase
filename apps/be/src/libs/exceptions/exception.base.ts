/** Field-level detail for the error envelope — lets the FE highlight the offending input. */
export interface ErrorDetail {
  field?: string;
  rule?: string;
  message: string;
}

export interface SerializedException {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

/**
 * Base of every THROWN technical failure. Business rejections are NOT thrown — they are
 * returned as `Result<T, DomainError>` and rendered as outcome bodies by the controller
 * (docs/adr/0001-outcome-model-at-the-http-boundary.md).
 */
export abstract class ExceptionBase extends Error {
  abstract code: string;

  constructor(
    override readonly message: string,
    override readonly cause?: Error,
    readonly metadata?: unknown,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
  }

  toJSON(): SerializedException {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}
