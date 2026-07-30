import { fromDateRangeLiteral, toDateRangeLiteral } from './daterange';

describe('daterange literal mapping', () => {
  it('serializes an inclusive day interval', () => {
    expect(toDateRangeLiteral('2026-08-01', '2026-08-05')).toBe('[2026-08-01,2026-08-05]');
  });

  it('parses the Postgres-normalized half-open form back to inclusive days', () => {
    // [2026-08-01,2026-08-05] is stored as [2026-08-01,2026-08-06)
    expect(fromDateRangeLiteral('[2026-08-01,2026-08-06)')).toEqual({
      start: '2026-08-01',
      endInclusive: '2026-08-05',
    });
  });

  it('parses a closed literal unchanged', () => {
    expect(fromDateRangeLiteral('[2026-08-01,2026-08-05]')).toEqual({
      start: '2026-08-01',
      endInclusive: '2026-08-05',
    });
  });

  it('throws on unbounded or malformed ranges (never produced by this app)', () => {
    expect(() => fromDateRangeLiteral('[,2026-08-05)')).toThrow();
    expect(() => fromDateRangeLiteral('empty')).toThrow();
  });
});
