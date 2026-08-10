/**
 * The dresses.category_id FK (ON DELETE RESTRICT) refused the delete: a dress was assigned to
 * the category between the service's count pre-check and this write. The service re-queries the
 * count and answers the SAME `rejected_category_in_use` outcome as the pre-check (ADR 0001 §2).
 */
export class CategoryStillReferencedError extends Error {
  constructor(cause?: Error) {
    super('The category is still referenced by dresses');
    this.name = 'CategoryStillReferencedError';
    this.cause = cause;
  }
}
