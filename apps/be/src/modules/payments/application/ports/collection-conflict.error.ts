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
