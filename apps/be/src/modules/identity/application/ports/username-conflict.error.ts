/**
 * The staff_users lower(username) UNIQUE index refused a write: another request took the
 * username between the service's precondition check and this insert. Translated into the port's
 * own exception so no slonik type escapes the adapter — the service turns it back into the SAME
 * `rejected_username_taken` outcome as the pre-check (ADR 0001 §2).
 */
export class UsernameConflictError extends Error {
  constructor(cause?: Error) {
    super('That username is already taken');
    this.name = 'UsernameConflictError';
    this.cause = cause;
  }
}
