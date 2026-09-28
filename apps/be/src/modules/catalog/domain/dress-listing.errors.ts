import { ExceptionBase } from '../../../libs/exceptions';

/**
 * RETURNED (never thrown) business rejections of the DressListing aggregate
 * (docs/design/catalog/public-listing.md §2 outcome catalog; ADR 0001 §3). Payloads are TYPED
 * fields so the controller renders them without digging in metadata.
 */
export class ListingNotFoundError extends ExceptionBase {
  static readonly message = 'Listing not found';
  public readonly code = 'CATALOG.LISTING_NOT_FOUND';

  constructor(cause?: Error) {
    super(ListingNotFoundError.message, cause);
  }
}

/** R1 — pre-check AND the UNIQUE(slug) race produce this same error (ADR 0001 §3 race rule). */
export class ListingSlugTakenError extends ExceptionBase {
  static readonly message = 'Another listing already uses this slug';
  public readonly code = 'CATALOG.LISTING_SLUG_TAKEN';

  constructor(
    readonly slug: string,
    cause?: Error,
  ) {
    super(ListingSlugTakenError.message, cause, { slug });
  }
}

/** R2 — the slug of a listing that was EVER published never changes (shared links must not 404). */
export class ListingSlugLockedError extends ExceptionBase {
  static readonly message = 'The slug of a listing that has been published cannot change';
  public readonly code = 'CATALOG.LISTING_SLUG_LOCKED';

  constructor(cause?: Error) {
    super(ListingSlugLockedError.message, cause);
  }
}

/** R3 — a published listing keeps at least one photo. */
export class ListingPhotoRequiredError extends ExceptionBase {
  static readonly message = 'A published listing must keep at least one photo';
  public readonly code = 'CATALOG.LISTING_PHOTO_REQUIRED';

  constructor(cause?: Error) {
    super(ListingPhotoRequiredError.message, cause);
  }
}

export type ListingPublishRequirement = 'photo' | 'active_dress';

/** Publish refused: every missing requirement is named, so the CMS lists them all at once. */
export class ListingNotPublishableError extends ExceptionBase {
  static readonly message = 'The listing does not meet the publishing requirements';
  public readonly code = 'CATALOG.LISTING_NOT_PUBLISHABLE';

  constructor(
    readonly missing: ListingPublishRequirement[],
    cause?: Error,
  ) {
    super(ListingNotPublishableError.message, cause, { missing });
  }
}

/** SetListingDresses named dress ids that do not exist (reuses `rejected_dress_not_found`). */
export class ListingDressesNotFoundError extends ExceptionBase {
  static readonly message = 'Some dresses do not exist';
  public readonly code = 'CATALOG.LISTING_DRESSES_NOT_FOUND';

  constructor(
    readonly dressIds: string[],
    cause?: Error,
  ) {
    super(ListingDressesNotFoundError.message, cause, { dressIds });
  }
}

/**
 * R8 / §6.M — staff may delete only a listing that was NEVER published; the owner may delete any.
 * A denial named in the spec → 403 OUTCOME `{ status: 'forbidden', reason:
 * 'listing_published_owner_only' }`, not the guard envelope.
 */
export class ListingDeleteOwnerOnlyError extends ExceptionBase {
  static readonly message = 'Only the owner may delete a listing that has been published';
  public readonly code = 'CATALOG.LISTING_DELETE_OWNER_ONLY';

  constructor(cause?: Error) {
    super(ListingDeleteOwnerOnlyError.message, cause);
  }
}
