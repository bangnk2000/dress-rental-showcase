import { AggregateID } from '../../../../libs/ddd/entity.base';
import { DressListingEntity } from '../../domain/dress-listing.entity';

export const DRESS_LISTING_REPOSITORY = Symbol('DRESS_LISTING_REPOSITORY');

/**
 * Write side of the DressListing aggregate. Each method is ONE statement or ONE transaction, and
 * each carries its race guard IN the write (spec §2 Concurrency) — the adapter translates the
 * constraint/0-row outcomes into the port errors of `listing-write-conflict.errors.ts`, so no
 * slonik type escapes and the service returns the SAME outcome the pre-check would have.
 */
export interface DressListingRepositoryPort {
  nextId(): AggregateID;

  /** Loads the listing WITH its attached dress ids. */
  findOneById(id: AggregateID): Promise<DressListingEntity | null>;

  /** Whether a listing other than `exceptId` uses `slug` (the R1 pre-check). */
  slugTaken(slug: string, exceptId?: AggregateID): Promise<boolean>;

  /** Throws ListingSlugConflictError when UNIQUE(slug) refuses (lost race). */
  insert(entity: DressListingEntity): Promise<void>;

  /**
   * Writes the CONTENT columns (+ the slug when `slugChanged`). Never writes published_at /
   * first_published_at — publish owns them, so a concurrent publish is never overwritten.
   * - slug change is guarded by `WHERE first_published_at IS NULL` → 0 rows: ListingSlugLockedConflictError (R2)
   * - UNIQUE(slug) → ListingSlugConflictError (R1) · the photo CHECK → ListingPhotoCheckError (R3)
   * - row gone → ListingGoneError
   */
  updateContent(entity: DressListingEntity, options: { slugChanged: boolean }): Promise<void>;

  /** Replaces the attached set in ONE transaction; listing gone (FK) → ListingGoneError. */
  replaceDresses(listingId: AggregateID, dressIds: string[]): Promise<void>;

  /** Which of `dressIds` exist in the catalog. */
  findExistingDressIds(dressIds: string[]): Promise<string[]>;

  /** How many ATTACHED dresses are `active` (publish precondition). */
  countActiveDresses(listingId: AggregateID): Promise<number>;

  /**
   * `published_at = COALESCE(published_at, now)`, `first_published_at = COALESCE(…, now)`.
   * The photo CHECK → ListingPhotoCheckError (photos removed after the pre-check); row gone →
   * ListingGoneError.
   */
  markPublished(listingId: AggregateID, now: Date): Promise<void>;

  /** `published_at = NULL`; row gone → ListingGoneError. */
  markUnpublished(listingId: AggregateID, now: Date): Promise<void>;

  /**
   * Deletes the listing (items cascade; dresses untouched). `onlyIfNeverPublished` adds
   * `AND first_published_at IS NULL` to the DELETE (R8 for staff). Returns the deleted row count.
   */
  delete(listingId: AggregateID, options: { onlyIfNeverPublished: boolean }): Promise<number>;
}
