/**
 * The categories lower(name) UNIQUE index refused a write: another request took the name between
 * the service's precondition check and this insert. Translated into the port's own exception so
 * no slonik type escapes the adapter — the service turns it back into the SAME
 * `rejected_category_name_taken` outcome as the pre-check (ADR 0001 §2).
 */
export class CategoryNameConflictError extends Error {
  constructor(cause?: Error) {
    super('That category name is already taken');
    this.name = 'CategoryNameConflictError';
    this.cause = cause;
  }
}
