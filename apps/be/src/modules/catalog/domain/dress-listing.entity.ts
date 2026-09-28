import { Err, Ok, Result } from 'oxide.ts';
import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';
import {
  ListingDeleteOwnerOnlyError,
  ListingNotPublishableError,
  ListingPhotoRequiredError,
  ListingPublishRequirement,
  ListingSlugLockedError,
} from './dress-listing.errors';
import { CreateListingProps, DressListingProps, ListingContent } from './dress-listing.types';
import { ListingSlug } from './listing-slug.value-object';

export const LISTING_MAX_PHOTOS = 10;

/**
 * DressListing — the public MODEL of a dress (docs/design/catalog/public-listing.md). Holds the web
 * content ONCE; physical dresses are attached as a set of ids. Sizes, displayed price and
 * availability are derived on the read side, never kept here.
 *
 * Rules the entity decides (the DB backs each one — see the migration):
 *   R2 slug locked once first published · R3 published ⇒ ≥ 1 photo · R8 staff delete only never
 *   published listings · publish needs a photo AND an active dress.
 */
export class DressListingEntity extends AggregateRoot<DressListingProps> {
  static create(create: CreateListingProps, id: string, now: Date): DressListingEntity {
    const props: DressListingProps = {
      ...create,
      photoUrls: [...create.photoUrls],
      publishedAt: null,
      firstPublishedAt: null,
      dressIds: [],
    };
    return new DressListingEntity({ id, props, createdAt: now, updatedAt: now });
  }

  get slug(): ListingSlug {
    return this.props.slug;
  }

  get isPublished(): boolean {
    return this.props.publishedAt !== null;
  }

  /** "Đã từng đăng" (§6.M) — the meaning of "published" for R2 and R8. */
  get wasEverPublished(): boolean {
    return this.props.firstPublishedAt !== null;
  }

  get dressIds(): string[] {
    return [...this.props.dressIds];
  }

  /**
   * R2. Returns whether the slug actually changed (the repository then writes it with the
   * `WHERE first_published_at IS NULL` guard). Same slug = no change, allowed even when locked.
   */
  changeSlug(slug: ListingSlug, now: Date): Result<boolean, ListingSlugLockedError> {
    if (slug.equals(this.props.slug)) return Ok(false);
    if (this.wasEverPublished) return Err(new ListingSlugLockedError());
    this.props.slug = slug;
    this.setUpdatedAt(now);
    return Ok(true);
  }

  /** R3: a listing that is ON the web cannot lose its last photo. */
  updateContent(content: ListingContent, now: Date): Result<void, ListingPhotoRequiredError> {
    if (this.isPublished && content.photoUrls.length === 0) {
      return Err(new ListingPhotoRequiredError());
    }
    this.props.name = content.name;
    this.props.tagline = content.tagline;
    this.props.description = content.description;
    this.props.occasions = content.occasions;
    this.props.retailPrice = content.retailPrice;
    this.props.specs = { ...content.specs };
    this.props.photoUrls = [...content.photoUrls];
    this.props.isHot = content.isHot;
    this.setUpdatedAt(now);
    this.validate();
    return Ok(undefined);
  }

  /** Full replacement of the attached set; duplicates collapse (the pair is a PK). */
  setDresses(dressIds: readonly string[], now: Date): void {
    this.props.dressIds = [...new Set(dressIds)];
    this.setUpdatedAt(now);
  }

  /**
   * Publish needs a cover photo AND ≥ 1 active dress (otherwise the web would hide it anyway, R5).
   * Every missing requirement is reported. Already published → Ok, nothing changes (idempotent);
   * `firstPublishedAt` is set only once, ever.
   */
  publish(
    now: Date,
    activeDressCount: number,
  ): Result<void, ListingNotPublishableError> {
    const missing: ListingPublishRequirement[] = [];
    if (this.props.photoUrls.length === 0) missing.push('photo');
    if (activeDressCount < 1) missing.push('active_dress');
    if (missing.length > 0) return Err(new ListingNotPublishableError(missing));
    if (this.isPublished) return Ok(undefined);
    this.props.publishedAt = now;
    this.props.firstPublishedAt = this.props.firstPublishedAt ?? now;
    this.setUpdatedAt(now);
    return Ok(undefined);
  }

  /** Hide from the web. Idempotent; never clears `firstPublishedAt` (the slug stays locked). */
  unpublish(now: Date): void {
    if (!this.isPublished) return;
    this.props.publishedAt = null;
    this.setUpdatedAt(now);
  }

  /** R8: the owner deletes anything; staff only a listing that was never published. */
  assertDeletableBy(role: 'owner' | 'staff'): Result<void, ListingDeleteOwnerOnlyError> {
    if (role !== 'owner' && this.wasEverPublished) {
      return Err(new ListingDeleteOwnerOnlyError());
    }
    return Ok(undefined);
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.name, 'name');
    this.guardAgainstEmpty(this.props.slug, 'slug');
    this.guardAgainstEmpty(this.props.occasions, 'occasions');
    if (this.props.photoUrls.length > LISTING_MAX_PHOTOS) {
      throw new ArgumentInvalidException(`A listing holds at most ${LISTING_MAX_PHOTOS} photos`);
    }
    if (this.props.publishedAt !== null && this.props.photoUrls.length === 0) {
      throw new ArgumentInvalidException('A published listing must have a photo');
    }
  }
}
