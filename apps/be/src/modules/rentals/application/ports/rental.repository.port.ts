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
}
