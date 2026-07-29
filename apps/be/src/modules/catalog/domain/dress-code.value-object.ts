import { DomainPrimitive, ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/** Shop-assigned dress code, e.g. 'VD-012'. Uppercase letters, digits, dashes; 2–20 chars. */
export class DressCode extends ValueObject<string> {
  protected validate({ value }: DomainPrimitive<string>): void {
    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(value)) {
      throw new ArgumentInvalidException(
        'Dress code must be 2-20 chars of uppercase letters, digits or dashes',
      );
    }
  }

  static create(value: string): DressCode {
    return new DressCode({ value: value.trim().toUpperCase() });
  }
}
