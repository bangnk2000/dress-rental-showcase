import { ExceptionBase } from '../../../../libs/exceptions';

/**
 * Part of the RentalRepositoryPort CONTRACT: any implementation MUST translate a violation of the
 * `rental_items_no_overlap` EXCLUDE constraint into this exception, so no slonik/pg error type
 * ever reaches the application layer.
 *
 * It is a technical signal ("the DB refused the write"), not a business rejection. The only
 * legitimate handler is `create-rental.service.ts`, which converts it into the SAME business
 * outcome as the pre-check path — `rejected_dress_unavailable`
 * (docs/adr/0001-outcome-model-at-the-http-boundary.md §2). Uncaught, it is a 500, which is
 * correct: it would mean a write path changed periods without expecting a race.
 */
export class RentalItemsOverlapError extends ExceptionBase {
  static readonly message = 'The rental_items overlap constraint refused this write';
  public readonly code = 'RENTALS.ITEMS_OVERLAP_CONSTRAINT';

  constructor(cause?: Error, metadata?: unknown) {
    super(RentalItemsOverlapError.message, cause, metadata);
  }
}
