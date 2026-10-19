import { ArgumentInvalidException } from '../../../libs/exceptions';
import { Styles, STYLES } from './style.value-object';

describe('Styles (public-listing R4)', () => {
  it('accepts 1..7 distinct codes of the fixed set', () => {
    expect(Styles.create(['short']).values).toEqual(['short']);
    expect(Styles.create([...STYLES]).values).toHaveLength(7);
  });

  it('refuses zero styles', () => {
    expect(() => Styles.create([])).toThrow(ArgumentInvalidException);
  });

  it('refuses an unknown code', () => {
    expect(() => Styles.create(['short', 'prom'])).toThrow(ArgumentInvalidException);
  });

  it('refuses a repeated code', () => {
    expect(() => Styles.create(['short', 'short'])).toThrow(ArgumentInvalidException);
  });
});
