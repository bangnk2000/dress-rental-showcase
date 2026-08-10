import { ExceptionBase } from '../../../libs/exceptions';

/**
 * RETURNED (never thrown) business rejections of the catalog context — rendered as outcome bodies
 * per docs/adr/0001-outcome-model-at-the-http-boundary.md §3. `dressCode` is the outcome payload:
 * the FE puts the field error on the code input without a second request.
 */
export class DressCodeAlreadyExistsError extends ExceptionBase {
  static readonly message = 'A dress with this code already exists';
  public readonly code = 'CATALOG.DRESS_CODE_ALREADY_EXISTS';

  constructor(
    readonly dressCode: string,
    cause?: Error,
  ) {
    super(DressCodeAlreadyExistsError.message, cause, { dressCode });
  }
}

export class DressNotFoundError extends ExceptionBase {
  static readonly message = 'Dress not found';
  public readonly code = 'CATALOG.DRESS_NOT_FOUND';

  constructor(cause?: Error, metadata?: unknown) {
    super(DressNotFoundError.message, cause, metadata);
  }
}

/**
 * FR-CAT-05 R1: the purchase price is the owner's field. A staff request CARRYING it is refused
 * BY NAME — silently dropping the field would tell the UI a lie ("saved" when it was not).
 * Rendered as the 403 outcome { status: 'forbidden', reason: 'purchase_price_owner_only' },
 * same family as the late-fee waiver denial.
 */
export class PurchasePriceOwnerOnlyError extends ExceptionBase {
  static readonly message = 'Only the owner may set the purchase price';
  public readonly code = 'CATALOG.PURCHASE_PRICE_OWNER_ONLY';

  constructor(cause?: Error, metadata?: unknown) {
    super(PurchasePriceOwnerOnlyError.message, cause, metadata);
  }
}

export class DressAlreadyRetiredError extends ExceptionBase {
  static readonly message = 'Dress is already retired';
  public readonly code = 'CATALOG.DRESS_ALREADY_RETIRED';

  constructor(cause?: Error, metadata?: unknown) {
    super(DressAlreadyRetiredError.message, cause, metadata);
  }
}
