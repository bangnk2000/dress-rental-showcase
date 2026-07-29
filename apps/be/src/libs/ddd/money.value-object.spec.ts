import { Money } from './money.value-object';
import { ArgumentInvalidException } from '../exceptions';

describe('Money (VND, integer)', () => {
  it('accepts non-negative integers and supports arithmetic', () => {
    expect(Money.create(1_500_000).add(Money.create(500_000)).amount).toBe(2_000_000);
    expect(Money.create(0).amount).toBe(0);
  });

  it('rejects negatives and decimals', () => {
    expect(() => Money.create(-1)).toThrow(ArgumentInvalidException);
    expect(() => Money.create(1.5)).toThrow(ArgumentInvalidException);
  });

  it('rejects a subtraction that would go negative', () => {
    expect(() => Money.create(100).subtract(Money.create(200))).toThrow(
      ArgumentInvalidException,
    );
  });
});
