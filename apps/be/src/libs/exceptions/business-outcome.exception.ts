import { HttpException } from '@nestjs/common';

/**
 * A business REJECTION is an outcome, not a fault.
 *
 * Controllers throw this after `match()`ing a returned `Result` Err, to render
 * `{ "status": "<outcome_code>", ...payload }` — default 422, or 403 for a denial that the
 * use-case spec names as an outcome. The global filter passes the body through untouched: no
 * error envelope, no `GENERIC.*` code.
 *
 * The outcome code is snake_case Ubiquitous Language taken from the approved catalog in
 * docs/adr/0001-outcome-model-at-the-http-boundary.md §3. The FE branches on it, so renaming an
 * approved code is a breaking contract change — not an edit.
 */
export class BusinessOutcomeException extends HttpException {
  constructor(body: { status: string } & Record<string, unknown>, statusCode = 422) {
    super(body, statusCode);
  }
}
