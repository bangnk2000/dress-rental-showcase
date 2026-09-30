/**
 * Writes ONE `ListingPlan` (see `listings-from-dresses.ts`) through ports the script wires to the
 * real services — kept apart from the script so the failure paths are unit-testable.
 *
 * Create and attach are two commands (two transactions), so a failed attach is compensated: the
 * fresh draft is discarded, otherwise the next run would not see the group as listed and would
 * create a second draft under a fallback slug.
 */
import { Result } from 'oxide.ts';
import { ListingPlan } from './listings-from-dresses';

export interface ListingPlanWriter {
  /** Which of `dressIds` belong to a listing NOW (re-read right before writing). */
  listedDressIds(dressIds: string[]): Promise<ReadonlySet<string>>;
  create(plan: ListingPlan): Promise<Result<string, Error>>;
  attach(listingId: string, dressIds: string[]): Promise<Result<unknown, Error>>;
  /** Deletes a never-published draft (the one `create` just made). */
  discard(listingId: string): Promise<Result<unknown, Error>>;
}

export type ApplyListingPlanOutcome =
  | { kind: 'created'; listingId: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; message: string };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function applyListingPlan(
  plan: ListingPlan,
  writer: ListingPlanWriter,
): Promise<ApplyListingPlanOutcome> {
  // The planner's read may be minutes old (a --dry-run review in between): staff may have listed
  // one of these dresses since. Multi-membership is legal (spec §6.G), so this is the tool's own
  // "don't duplicate what staff did" rule, re-checked as late as the commands allow.
  const listed = await writer.listedDressIds(plan.dressIds);
  if (listed.size > 0) {
    return { kind: 'skipped', reason: 'vừa được gắn vào một mẫu khác trong lúc chạy' };
  }

  let listingId: string;
  try {
    const created = await writer.create(plan);
    if (created.isErr()) return { kind: 'failed', message: created.unwrapErr().message };
    listingId = created.unwrap();
  } catch (error) {
    // VO validation (e.g. a name the entity refuses) throws — nothing was written.
    return { kind: 'failed', message: messageOf(error) };
  }

  let attachError: string | null;
  try {
    const attached = await writer.attach(listingId, plan.dressIds);
    attachError = attached.isErr() ? attached.unwrapErr().message : null;
  } catch (error) {
    attachError = messageOf(error);
  }
  if (attachError === null) return { kind: 'created', listingId };

  let discardError: string | null;
  try {
    const discarded = await writer.discard(listingId);
    discardError = discarded.isErr() ? discarded.unwrapErr().message : null;
  } catch (error) {
    discardError = messageOf(error);
  }
  return {
    kind: 'failed',
    message:
      discardError === null
        ? `gắn váy thất bại, đã xoá nháp vừa tạo — ${attachError}`
        : `gắn váy thất bại VÀ không xoá được nháp ${listingId} (xoá tay trong /website) — ${attachError}; ${discardError}`,
  };
}
