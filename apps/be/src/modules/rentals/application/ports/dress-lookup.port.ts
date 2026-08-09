export const DRESS_LOOKUP = Symbol('DRESS_LOOKUP');

/** The little rentals needs to know about a dress, expressed in its own terms. */
export interface DressSnapshot {
  id: string;
  code: string;
  name: string;
  retired: boolean;
  rentalPrice: number;
  /**
   * The catalog's STANDARD deposit for this dress — a reference figure, not what was collected.
   * No deposit is recorded when a rental is created, so reads may show this number as a
   * suggestion (the return dialog pre-fills the refund with it) but must never present it as a
   * fact about this rental.
   */
  depositAmount: number;
}

/**
 * Read-only lookup into catalog-owned data. The adapter reads the dresses
 * TABLE directly (read side may hit the pool) — importing catalog CODE would
 * break the no-cross-module rule.
 */
export interface DressLookupPort {
  findByIds(dressIds: string[]): Promise<DressSnapshot[]>;
}
