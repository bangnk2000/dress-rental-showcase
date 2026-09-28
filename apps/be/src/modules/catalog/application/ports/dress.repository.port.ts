import { RepositoryPort } from '../../../../libs/ddd/repository.port';
import { DressEntity } from '../../domain/dress.entity';

export const DRESS_REPOSITORY = Symbol('DRESS_REPOSITORY');

export interface DressRepositoryPort extends RepositoryPort<DressEntity> {
  findOneByCode(code: string): Promise<DressEntity | null>;

  /**
   * Every code that starts with `prefix`, exact-character (no LIKE wildcards: `_` is a literal
   * here, which matters because it IS the duplicate separator, FR-CAT-08). Feeds
   * `DressCode.nextDuplicateOf`.
   */
  findCodesStartingWith(prefix: string): Promise<string[]>;

  /**
   * `insert`, plus the v1 price-history row in the SAME transaction (FR-CAT-06 R1/R4):
   * "price changed but the log missed it" must be an unrepresentable state.
   */
  insertWithHistory(entity: DressEntity, changedById: string | null): Promise<void>;

  /**
   * `insertWithHistory` for a DUPLICATE (FR-CAT-08), plus — in the SAME transaction — a copy of
   * every (listing, source dress) pair onto the new dress (public-listing R7): the copy becomes a
   * new size of every listing its source belongs to, or nothing is written.
   */
  insertDuplicateWithHistory(
    copy: DressEntity,
    changedById: string | null,
    sourceDressId: string,
  ): Promise<void>;

  /**
   * `save`, plus ONE price-history row in the SAME transaction. The CALLER decides whether the
   * prices actually changed (it holds the before-values); this method just guarantees atomicity.
   */
  saveWithPriceHistory(entity: DressEntity, changedById: string | null): Promise<void>;
}
