import { DomainPrimitive, ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/**
 * A code's duplicate suffix: `VD-012_3` = the 4th copy (0-based) of `VD-012`. Only a trailing
 * `_<digits>` counts — `VD_012` has an underscore but no copy number.
 */
const DUPLICATE_SUFFIX = /_(\d+)$/;

/**
 * Shop-assigned dress code, e.g. 'VD-012' or a duplicate 'VD-012_1'. Uppercase letters, digits,
 * dashes and underscores; 2–20 chars. The underscore exists for FR-CAT-08 duplicates ONLY by
 * convention — staff may type one, the format does not forbid it.
 */
export class DressCode extends ValueObject<string> {
  protected validate({ value }: DomainPrimitive<string>): void {
    if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(value)) {
      throw new ArgumentInvalidException(
        'Dress code must be 2-20 chars of uppercase letters, digits, dashes or underscores',
      );
    }
  }

  static create(value: string): DressCode {
    return new DressCode({ value: value.trim().toUpperCase() });
  }

  /**
   * The code a duplicate is numbered from: its own duplicate suffix stripped, so copying a copy
   * (`VD-012_1`) still yields `VD-012_<next>`, never `VD-012_1_0`.
   */
  static baseOf(code: string): string {
    return code.replace(DUPLICATE_SUFFIX, '');
  }

  /**
   * The next free duplicate code for `base` given the codes already taken: `_1` when none exists,
   * else max + 1 (FR-CAT-08 R1). Non-numeric or foreign suffixes among `taken` are ignored.
   */
  static nextDuplicateOf(base: string, taken: readonly string[]): DressCode {
    const prefix = `${base}_`;
    let max = 0; // no copy yet → _1 (FR-CAT-08: numbering starts at 1)
    for (const code of taken) {
      if (!code.startsWith(prefix)) continue;
      const suffix = code.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      max = Math.max(max, Number(suffix));
    }
    return DressCode.create(`${prefix}${max + 1}`);
  }
}
