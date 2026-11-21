import { RepositoryPort } from '../../../../libs/ddd/repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';

export const RENTAL_REPOSITORY = Symbol('RENTAL_REPOSITORY');

export interface RentalRepositoryPort extends RepositoryPort<RentalEntity> {
  /**
   * Of the given dresses, the ones with a blocking item overlapping the period.
   * Availability precondition — the EXCLUDE constraint backs it against races.
   *
   * `excludeRentalId`: ignore that rental's own items — an edit (FR-RENT-13) must not collide
   * with the booking it is replacing.
   */
  findBlockedDressIds(
    dressIds: string[],
    blockedPeriod: RentalPeriod,
    options?: { excludeRentalId?: string },
  ): Promise<string[]>;

  /**
   * `save` for an EDIT (FR-RENT-13), plus a re-read of the status under the rental's row lock —
   * the same lock cancel/return/record-collection take — so a rental closed in the meantime is
   * never reopened by a stale aggregate (`RentalStateChangedError`, nothing written). Items no
   * longer in the aggregate are deleted; an overlap race throws `RentalItemsOverlapError`.
   */
  saveUpdated(entity: RentalEntity): Promise<void>;

  /**
   * `save`, plus a check that the deposit the caller based its refund on is still what the ledger
   * holds — both under the rental's row lock, so no collection can commit between the two.
   *
   * `expectedDepositCollected` null = the caller made no claim (nothing to verify). A mismatch
   * throws `DepositBasisChangedError` and writes nothing.
   */
  saveReturned(entity: RentalEntity, expectedDepositCollected: number | null): Promise<void>;

  /**
   * `save` for a PICKUP, plus a re-read of the status under the rental's row lock: anything but
   * `booked` (a cancel committed since the load) → `RentalStateChangedError`, nothing written.
   * `saveReturned` does the same for `out`.
   *
   * FR-RENT-14, under the same lock: `depositCollected` null and no deposit on file →
   * `DepositMissingError`; a deposit given while one is on file → `DepositOnFileError`; otherwise
   * the given deposit is written in the SAME transaction as booked → out.
   */
  savePickedUp(entity: RentalEntity, depositCollected: number | null): Promise<void>;

  /** `insert` + the money handed over at booking, in one transaction (FR-RENT-14). */
  insertWithCollection(entity: RentalEntity, collection: BookingCollection): Promise<void>;

  /**
   * `save` for a CANCEL (rentals/cancel-with-refund), with the ledger re-read under the rental's
   * row lock — the lock record-collection takes too — so a collection and this cancel take turns:
   *
   * - row no longer open (returned/cancelled) → `RentalStateChangedError`
   * - ledger empty → cancel; a `settlement` claiming money on file → `LedgerBasisChangedError(0, 0)`
   * - money on file and the row is `out` → `LedgerNotEmptyError` (return is the way out)
   * - money on file, `booked`: `settlement` must be present and its expected amounts equal the
   *   ledger (else `LedgerBasisChangedError` with what IS on file); then its refunds are written
   *   in the SAME transaction as the status flip.
   *
   * Every throw writes nothing.
   */
  saveCancelled(entity: RentalEntity, settlement: CancelSettlement | null): Promise<void>;
}

/** Money handed over at booking (FR-RENT-14); null/absent amounts = not collected. */
export interface BookingCollection {
  deposit: number | null;
  rentalFee: number | null;
  note: string | null;
}

/** What a cancel of a rental with money on file claims and pays back. */
export interface CancelSettlement {
  expectedDepositCollected: number;
  expectedRentalFeeCollected: number;
  /** Rows to write; amounts > 0 only (zero = "no refund" = no row). */
  refunds: { kind: 'deposit_refund' | 'rental_fee_refund'; amount: number; note: string | null }[];
}
