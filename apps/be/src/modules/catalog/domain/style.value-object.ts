import { ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/**
 * The fixed set of styles (spec §6.D). Same seven codes as the `dress_listings.styles` CHECK
 * constraint (R4) — adding one is a migration plus this list, never only one of them. Labels are
 * NOT here: the CMS and the web translate the code.
 */
export const STYLES = [
  'short',
  'silk',
  'ao-dai',
  'off-shoulder',
  'sleeved',
  'strappy-strapless',
  'accessory',
] as const;

export type Style = (typeof STYLES)[number];

export function isStyle(value: string): value is Style {
  return (STYLES as readonly string[]).includes(value);
}

interface StylesProps {
  values: Style[];
}

/**
 * R4: a listing has ≥ 1 style, each from the fixed set, none repeated. Invalid input is thrown
 * (→ 400 envelope), not an outcome.
 */
export class Styles extends ValueObject<StylesProps> {
  protected validate({ values }: StylesProps): void {
    if (values.length < 1) {
      throw new ArgumentInvalidException('A listing needs at least one style');
    }
    if (new Set(values).size !== values.length) {
      throw new ArgumentInvalidException('Styles must not repeat');
    }
    for (const value of values) {
      if (!isStyle(value)) {
        throw new ArgumentInvalidException(`Unknown style '${String(value)}'`);
      }
    }
  }

  static create(values: readonly string[]): Styles {
    return new Styles({ values: [...values] as Style[] });
  }

  get values(): Style[] {
    return [...this.props.values];
  }
}
