export const RENTAL_LOOKUP = Symbol('RENTAL_LOOKUP');

/**
 * Read-only existence check into rentals-owned data. The adapter reads the
 * rentals TABLE directly — importing rentals CODE would break the
 * no-cross-module rule (same boundary trick as rentals' DressLookupAdapter).
 */
export interface RentalLookupPort {
  exists(rentalId: string): Promise<boolean>;
}
