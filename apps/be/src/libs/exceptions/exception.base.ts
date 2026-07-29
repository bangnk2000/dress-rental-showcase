export interface SerializedException {
  message: string;
  code: string;
  correlationId?: string;
}

export abstract class ExceptionBase extends Error {
  abstract code: string;

  constructor(
    override readonly message: string,
    override readonly cause?: Error,
    readonly metadata?: unknown,
  ) {
    super(message);
  }

  toJSON(): SerializedException {
    return { message: this.message, code: this.code };
  }
}
