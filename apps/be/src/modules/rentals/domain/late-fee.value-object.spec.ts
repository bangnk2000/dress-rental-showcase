import { LateFeeQuote } from './late-fee.value-object';

const RATE = 200_000;

function quote(dueDate: string, referenceDate: string, dressCount = 1): LateFeeQuote {
  return LateFeeQuote.compute({ dueDate, referenceDate, dressCount, dailyRateAmount: RATE });
}

/** FR-RENT-09 R1–R2, R6 — docs/design/rentals/settle-late-fee.md */
describe('LateFeeQuote', () => {
  it('R1: returning ON the due date is on time', () => {
    const result = quote('2026-08-03', '2026-08-03');

    expect(result.daysLate).toBe(0);
    expect(result.suggestedLateFee).toBe(0);
  });

  it('R1: returning early is not negative', () => {
    expect(quote('2026-08-03', '2026-08-01').daysLate).toBe(0);
    expect(quote('2026-08-03', '2026-08-01').suggestedLateFee).toBe(0);
  });

  it('R1+R2: each calendar day after the due date costs the rate, per dress', () => {
    expect(quote('2026-08-03', '2026-08-04').suggestedLateFee).toBe(200_000);
    expect(quote('2026-08-03', '2026-08-06').suggestedLateFee).toBe(600_000);
    expect(quote('2026-08-03', '2026-08-06', 2).suggestedLateFee).toBe(1_200_000);
  });

  it('R1: the cleaning buffer is irrelevant — only the due date counts', () => {
    // The rental period ends 2026-08-03; items stay blocked through 08-05 (buffer 2), but the
    // customer is late from 08-04. The quote never sees the buffer, which is the point.
    expect(quote('2026-08-03', '2026-08-05').daysLate).toBe(2);
  });

  it('R2: no grace period and no cap', () => {
    expect(quote('2026-08-03', '2026-08-04').daysLate).toBe(1);
    expect(quote('2026-08-03', '2026-11-03').suggestedLateFee).toBe(92 * RATE);
  });

  it('R2: crossing a month boundary counts real calendar days', () => {
    expect(quote('2026-08-30', '2026-09-02').daysLate).toBe(3);
  });

  it('R6: computing twice with the same inputs gives the same result', () => {
    const first = quote('2026-08-03', '2026-08-07', 3);
    const second = quote('2026-08-03', '2026-08-07', 3);

    expect(first.toJSON()).toEqual(second.toJSON());
  });

  it('exposes an explicit read model, not the aggregate', () => {
    expect(quote('2026-08-03', '2026-08-05', 2).toJSON()).toEqual({
      dueDate: '2026-08-03',
      referenceDate: '2026-08-05',
      daysLate: 2,
      dressCount: 2,
      dailyRateAmount: RATE,
      suggestedLateFee: 800_000,
    });
  });
});
