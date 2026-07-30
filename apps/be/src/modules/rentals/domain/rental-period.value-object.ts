import { ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';
import { addDays } from '../../../libs/utils/date';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // Round-trip guards impossible dates like 2026-02-30 (Date silently rolls them over).
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export interface RentalPeriodProps {
  /** First rental day, `yyyy-mm-dd`, inclusive. */
  start: string;
  /** Last rental day, `yyyy-mm-dd`, inclusive. */
  end: string;
}

/** Closed date interval `[start, end]` — day precision, both bounds inclusive. */
export class RentalPeriod extends ValueObject<RentalPeriodProps> {
  protected validate(props: RentalPeriodProps): void {
    if (!isCalendarDate(props.start) || !isCalendarDate(props.end)) {
      throw new ArgumentInvalidException('Rental period dates must be valid yyyy-mm-dd dates');
    }
    if (props.start > props.end) {
      throw new ArgumentInvalidException('Rental period must not end before it starts');
    }
  }

  static create(start: string, end: string): RentalPeriod {
    return new RentalPeriod({ start, end });
  }

  get start(): string {
    return this.props.start;
  }

  get end(): string {
    return this.props.end;
  }

  /** The same interval with the end pushed out, e.g. by the cleaning buffer. */
  extendEndByDays(days: number): RentalPeriod {
    return RentalPeriod.create(this.start, addDays(this.end, days));
  }
}
