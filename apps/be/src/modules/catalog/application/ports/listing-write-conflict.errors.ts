/**
 * What the database refused on a DressListing write, translated by the adapter so no slonik type
 * escapes it. The services turn each back into the SAME returned outcome the application pre-check
 * produces (ADR 0001 §3 race rule: one business rule, one code, whichever layer notices it).
 */

/** UNIQUE(slug) refused — another request took the slug between pre-check and write (R1). */
export class ListingSlugConflictError extends Error {
  constructor(cause?: Error) {
    super('That listing slug is already taken');
    this.name = 'ListingSlugConflictError';
    this.cause = cause;
  }
}

/** The slug UPDATE's `WHERE first_published_at IS NULL` matched 0 rows — a publish got in first (R2). */
export class ListingSlugLockedConflictError extends Error {
  constructor() {
    super('The listing was published before the slug change landed');
    this.name = 'ListingSlugLockedConflictError';
  }
}

/** CHECK (published_at IS NULL OR cardinality(photo_urls) >= 1) refused the write (R3). */
export class ListingPhotoCheckError extends Error {
  constructor(cause?: Error) {
    super('A published listing must keep at least one photo');
    this.name = 'ListingPhotoCheckError';
    this.cause = cause;
  }
}

/** The listing row no longer exists (deleted concurrently). */
export class ListingGoneError extends Error {
  constructor(cause?: Error) {
    super('The listing no longer exists');
    this.name = 'ListingGoneError';
    this.cause = cause;
  }
}
