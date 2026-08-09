/**
 * The partial UNIQUE index (`payments_one_deposit_per_rental` /
 * `payments_one_rental_fee_per_rental`) refused a write: another request recorded the same kind
 * first. Translated into the port's own exception so no slonik type escapes the adapter — the
 * service turns it back into the SAME `rejected_*_already_recorded` outcome as its pre-check
 * (ADR 0001 §2, same pattern as rentals' RentalItemsOverlapError).
 */
export class CollectionConflictError extends Error {
  constructor(cause?: Error) {
    super('A movement of this kind already exists for the rental');
    this.name = 'CollectionConflictError';
    this.cause = cause;
  }
}

/**
 * The rental was NOT open at the moment the rows were about to be written — checked under a row
 * lock inside the write transaction, so it also covers a return that committed after the service's
 * pre-check read the status. `currentStatus` is null when the rental no longer exists at all.
 *
 * Like `CollectionConflictError`, this is the port's own exception: the service turns it back into
 * the SAME outcome its pre-check would have produced (ADR 0001 §2).
 */
export class RentalNotOpenError extends Error {
  constructor(
    readonly currentStatus: 'returned' | 'cancelled' | null,
    cause?: Error,
  ) {
    super('The rental is no longer open for money to be recorded against it');
    this.name = 'RentalNotOpenError';
    this.cause = cause;
  }
}
