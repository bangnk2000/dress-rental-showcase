/**
 * The `dresses.code` UNIQUE constraint refused a write: another request took the code between the
 * service's precondition check and this insert. Translated into the port's own exception so no
 * slonik type escapes the adapter — the service turns it back into the SAME
 * `rejected_dress_code_taken` outcome as the pre-check (ADR 0001 §2: one business rule, one code,
 * whichever layer notices it).
 */
export class DressCodeConflictError extends Error {
  constructor(cause?: Error) {
    super('That dress code is already taken');
    this.name = 'DressCodeConflictError';
    this.cause = cause;
  }
}
