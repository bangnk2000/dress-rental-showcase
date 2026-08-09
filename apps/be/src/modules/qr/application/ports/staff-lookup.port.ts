export const STAFF_LOOKUP = Symbol('STAFF_LOOKUP');

/**
 * Read-only lookup into identity-owned data, so a QR row can name the person who made it
 * (FR-QR-03) instead of showing a uuid. The adapter reads the `staff_users` TABLE directly —
 * importing identity CODE would break the no-cross-module rule (same boundary trick as rentals'
 * DressLookupAdapter).
 *
 * Resolved at READ time on purpose: `qr_links` rows are immutable, but a person's name is not, and
 * the history should show who they are now — not who they were when they made the code.
 */
export interface StaffLookupPort {
  /** Ids with no matching staff row are simply absent from the map. */
  findNamesByIds(staffIds: string[]): Promise<Map<string, string>>;
}
