import { ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/**
 * The fixed set of occasions (spec §6.D). Same six codes as the `dress_listings.occasions` CHECK
 * constraint (R4) — adding one is a migration plus this list, never only one of them. Labels are
 * NOT here: the CMS and the web translate the code.
 */
export const OCCASIONS = [
  'gala',
  'birthday',
  'ao-dai',
  'tea-party',
  'wedding-guest',
  'yearbook',
] as const;

export type Occasion = (typeof OCCASIONS)[number];

export function isOccasion(value: string): value is Occasion {
  return (OCCASIONS as readonly string[]).includes(value);
}

interface OccasionsProps {
  values: Occasion[];
}

/**
 * R4: a listing has ≥ 1 occasion, each from the fixed set, none repeated. Invalid input is thrown
 * (→ 400 envelope), not an outcome.
 */
export class Occasions extends ValueObject<OccasionsProps> {
  protected validate({ values }: OccasionsProps): void {
    if (values.length < 1) {
      throw new ArgumentInvalidException('A listing needs at least one occasion');
    }
    if (new Set(values).size !== values.length) {
      throw new ArgumentInvalidException('Occasions must not repeat');
    }
    for (const value of values) {
      if (!isOccasion(value)) {
        throw new ArgumentInvalidException(`Unknown occasion '${String(value)}'`);
      }
    }
  }

  static create(values: readonly string[]): Occasions {
    return new Occasions({ values: [...values] as Occasion[] });
  }

  get values(): Occasion[] {
    return [...this.props.values];
  }
}
