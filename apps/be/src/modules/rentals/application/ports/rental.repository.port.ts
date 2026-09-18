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
   * `save`, plus a check that the rental's ledger is EMPTY — both under the rental's row lock,
   * so record-collection (which locks the same row) and this cancel take turns. Any money row
   * throws `LedgerNotEmptyError` and writes nothing.
   */
  saveCancelled(entity: RentalEntity): Promise<void>;
}
