import { ExceptionBase } from '../../../libs/exceptions';

/**
 * RETURNED (never thrown) business rejections of the category side of catalog — rendered as
 * outcome bodies per docs/adr/0001-outcome-model-at-the-http-boundary.md §3.
 */
export class CategoryNameTakenError extends ExceptionBase {
  static readonly message = 'A category with this name already exists';
  public readonly code = 'CATALOG.CATEGORY_NAME_TAKEN';

  constructor(
    /** The trimmed name that collided — the FE puts the field error on the name input. */
    readonly name: string,
    cause?: Error,
  ) {
    super(CategoryNameTakenError.message, cause, { name });
  }
}

export class CategoryNotFoundError extends ExceptionBase {
  static readonly message = 'Category not found';
  public readonly code = 'CATALOG.CATEGORY_NOT_FOUND';

  constructor(cause?: Error, metadata?: unknown) {
    super(CategoryNotFoundError.message, cause, metadata);
  }
}

/**
 * R3: deleting a category that still holds dresses is refused with the COUNT, so the owner sees
 * how much reassigning stands between them and the delete — never a silent bulk un-labelling.
 */
export class CategoryInUseError extends ExceptionBase {
  static readonly message = 'The category still holds dresses';
  public readonly code = 'CATALOG.CATEGORY_IN_USE';

  constructor(
    readonly dressCount: number,
    cause?: Error,
  ) {
    super(CategoryInUseError.message, cause, { dressCount });
  }
}
