import { ArgumentInvalidException } from '../../../libs/exceptions';
import { RentalPeriod } from './rental-period.value-object';

describe('RentalPeriod', () => {
  it('accepts a valid inclusive range and extends the end by buffer days', () => {
    const period = RentalPeriod.create('2026-08-01', '2026-08-03');
    const blocked = period.extendEndByDays(2);
    expect(blocked.start).toBe('2026-08-01');
    expect(blocked.end).toBe('2026-08-05');
  });

  it('extends across month ends in UTC', () => {
    expect(RentalPeriod.create('2026-08-30', '2026-08-31').extendEndByDays(2).end).toBe(
      '2026-09-02',
    );
  });

  it('allows a single-day rental', () => {
    expect(() => RentalPeriod.create('2026-08-01', '2026-08-01')).not.toThrow();
  });

  it('rejects end before start', () => {
    expect(() => RentalPeriod.create('2026-08-03', '2026-08-01')).toThrow(
      ArgumentInvalidException,
    );
  });

  it('rejects malformed and impossible calendar dates', () => {
    expect(() => RentalPeriod.create('01-08-2026', '2026-08-03')).toThrow(
      ArgumentInvalidException,
    );
    expect(() => RentalPeriod.create('2026-02-30', '2026-03-01')).toThrow(
      ArgumentInvalidException,
    );
  });
});
