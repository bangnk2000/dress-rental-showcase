import { DomainPrimitive, ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/**
 * Shop-chosen category label ('Dạ hội', 'Cưới'). Trimmed, 1-50 chars; the ORIGINAL casing is
 * kept for display — uniqueness is case-insensitive at the DB (UNIQUE lower(name)) and in the
 * repository lookups.
 */
export class CategoryName extends ValueObject<string> {
  protected validate({ value }: DomainPrimitive<string>): void {
    if (value.length < 1 || value.length > 50) {
      throw new ArgumentInvalidException('Category name must be 1-50 characters');
    }
  }

  static create(value: string): CategoryName {
    return new CategoryName({ value: value.trim() });
  }
}
