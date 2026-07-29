import { ValueObject, DomainPrimitive } from './value-object.base';
import { Guard } from '../guard';
import { ArgumentInvalidException } from '../exceptions';

/** VND amount as a non-negative integer (no decimals in VND). */
export class Money extends ValueObject<number> {
  protected validate({ value }: DomainPrimitive<number>): void {
    if (!Guard.isPositiveInteger(value)) {
      throw new ArgumentInvalidException('Money must be a non-negative integer (VND)');
    }
  }

  static create(amount: number): Money {
    return new Money({ value: amount });
  }

  get amount(): number {
    return this.unpack();
  }

  add(other: Money): Money {
    return Money.create(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    return Money.create(this.amount - other.amount);
  }
}
