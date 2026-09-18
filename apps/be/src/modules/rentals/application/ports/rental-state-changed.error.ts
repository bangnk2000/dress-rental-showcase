import { ExceptionBase } from '../../../../libs/exceptions';
import { RentalStatus } from '../../domain/rental.types';

/**
 * Part of the RentalRepositoryPort CONTRACT for `saveUpdated`: re-read under the rental's row
 * lock, the row is no longer OPEN (booked|out) — a cancel or return committed between the
 * service's load and this write. Writing the stale aggregate would silently reopen a closed
 * rental (status back to booked, items blocking again), so the write is refused instead.
 *
 * Technical signal, not a business rejection — `update-rental.service.ts` converts it into the
 * SAME `rejected_update_not_allowed` outcome the pre-check yields (one rule, one code).
 */
export class RentalStateChangedError extends ExceptionBase {
  static readonly message = 'The rental left the open state before the write';
  public readonly code = 'RENTALS.STATE_CHANGED';

  constructor(
    readonly currentStatus: RentalStatus,
    cause?: Error,
  ) {
    super(RentalStateChangedError.message, cause, { currentStatus });
  }
}
