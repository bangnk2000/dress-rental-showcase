import { DomainPrimitive, ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/**
 * Login identifier, shop-assigned ('lan', 'chi-ca'). Lowercased on creation so 'Lan' and 'lan'
 * are the same account — phone keyboards capitalize on their own. The DB backs this with a
 * UNIQUE index on lower(username).
 */
export class Username extends ValueObject<string> {
  protected validate({ value }: DomainPrimitive<string>): void {
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(value)) {
      throw new ArgumentInvalidException(
        'Username must be 3-30 chars of lowercase letters, digits, dot, underscore or dash',
      );
    }
  }

  static create(value: string): Username {
    return new Username({ value: value.trim().toLowerCase() });
  }
}
