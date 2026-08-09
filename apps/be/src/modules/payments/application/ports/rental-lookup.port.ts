export const RENTAL_LOOKUP = Symbol('RENTAL_LOOKUP');

/**
 * The rental lifecycle as payments needs to read it. Declared HERE rather than imported from the
 * rentals module: this context reads the rentals TABLE, never rentals CODE (same boundary trick as
 * rentals' DressSnapshot).
 */
export type RentalStatusSnapshot = 'booked' | 'out' | 'returned' | 'cancelled';

/**
 * Read-only lookup into rentals-owned data. The adapter reads the rentals TABLE directly —
 * importing rentals CODE would break the no-cross-module rule.
 */
export interface RentalLookupPort {
  /** Null = no such rental. */
  findStatus(rentalId: string): Promise<RentalStatusSnapshot | null>;
}
