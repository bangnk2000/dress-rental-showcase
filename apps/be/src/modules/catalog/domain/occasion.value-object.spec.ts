import { ArgumentInvalidException } from '../../../libs/exceptions';
import { Occasions, OCCASIONS } from './occasion.value-object';

describe('Occasions (public-listing R4)', () => {
  it('accepts 1..6 distinct codes of the fixed set', () => {
    expect(Occasions.create(['gala']).values).toEqual(['gala']);
    expect(Occasions.create([...OCCASIONS]).values).toHaveLength(6);
  });

  it('refuses zero occasions', () => {
    expect(() => Occasions.create([])).toThrow(ArgumentInvalidException);
  });

  it('refuses an unknown code', () => {
    expect(() => Occasions.create(['gala', 'prom'])).toThrow(ArgumentInvalidException);
  });

  it('refuses a repeated code', () => {
    expect(() => Occasions.create(['gala', 'gala'])).toThrow(ArgumentInvalidException);
  });
});
