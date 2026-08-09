import { RepositoryPort } from '../../../../libs/ddd/repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';

export const RENTAL_REPOSITORY = Symbol('RENTAL_REPOSITORY');

export interface RentalRepositoryPort extends RepositoryPort<RentalEntity> {
  /**
   * Of the given dresses, the ones with a blocking item overlapping the period.
   * Availability precondition — the EXCLUDE constraint backs it against races.
   */
  findBlockedDressIds(dressIds: string[], blockedPeriod: RentalPeriod): Promise<string[]>;

  /**
   * `save`, plus a check that the deposit the caller based its refund on is still what the ledger
   * holds — both under the rental's row lock, so no collection can commit between the two.
   *
   * `expectedDepositCollected` null = the caller made no claim (nothing to verify). A mismatch
   * throws `DepositBasisChangedError` and writes nothing.
   */
  saveReturned(entity: RentalEntity, expectedDepositCollected: number | null): Promise<void>;
}
