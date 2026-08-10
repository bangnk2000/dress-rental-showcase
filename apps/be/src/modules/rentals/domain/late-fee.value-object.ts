import { daysBetween } from '../../../libs/utils/date';

export interface LateFeeQuoteProps {
  /** Last rental day, inclusive — returning ON this day is on time. */
  dueDate: string;
  /** The shop day the dresses came back (or the day the quote is asked for). */
  referenceDate: string;
  daysLate: number;
  dressCount: number;
  /** VND per dress per day (config). */
  dailyRateAmount: number;
  suggestedLateFee: number;
}

/**
 * The late-fee rule of FR-RENT-09 (docs/design/rentals/settle-late-fee.md §2 R1–R2, R6):
 *
 *   daysLate         = calendar days AFTER dueDate, floored at 0 — the cleaning buffer is the
 *                      shop's own time and never counts as late (§6.Q2)
 *   suggestedLateFee = daysLate × dressCount × dailyRateAmount   (flat rate, no grace, no cap)
 *
 * A pure function of its inputs by construction: no clock, no storage, no cache (R6). The amount
 * the shop actually charges is a separate decision — see the waiver rules in the service.
 */
export class LateFeeQuote {
  private constructor(private readonly props: LateFeeQuoteProps) {}

  static compute(input: {
    dueDate: string;
    referenceDate: string;
    dressCount: number;
    dailyRateAmount: number;
  }): LateFeeQuote {
    const daysLate = Math.max(0, daysBetween(input.dueDate, input.referenceDate));
    return new LateFeeQuote({
      dueDate: input.dueDate,
      referenceDate: input.referenceDate,
      daysLate,
      dressCount: input.dressCount,
      dailyRateAmount: input.dailyRateAmount,
      suggestedLateFee: daysLate * input.dressCount * input.dailyRateAmount,
    });
  }

  get daysLate(): number {
    return this.props.daysLate;
  }

  get suggestedLateFee(): number {
    return this.props.suggestedLateFee;
  }

  /** Read model for the quote endpoint — explicit fields, no aggregate leakage. */
  toJSON(): LateFeeQuoteProps {
    return { ...this.props };
  }
}
