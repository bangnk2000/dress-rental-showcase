import { Entity } from '../../../libs/ddd/entity.base';
import { Money } from '../../../libs/ddd/money.value-object';
import { RentalPeriod } from './rental-period.value-object';

export interface RentalItemProps {
  dressId: string;
  price: Money;
  /** Rental period + cleaning buffer — the interval the EXCLUDE constraint guards. */
  blockedPeriod: RentalPeriod;
  /** false frees the calendar (cancelled rental) while keeping history. */
  blocking: boolean;
}

export interface CreateRentalItemProps {
  id: string;
  dressId: string;
  price: Money;
  blockedPeriod: RentalPeriod;
}

/** Child of the Rental aggregate — one booked dress. Never persisted on its own. */
export class RentalItemEntity extends Entity<RentalItemProps> {
  static create(create: CreateRentalItemProps, now: Date): RentalItemEntity {
    const { id, ...props } = create;
    return new RentalItemEntity({
      id,
      props: { ...props, blocking: true },
      createdAt: now,
      updatedAt: now,
    });
  }

  get dressId(): string {
    return this.props.dressId;
  }

  get price(): Money {
    return this.props.price;
  }

  get blockedPeriod(): RentalPeriod {
    return this.props.blockedPeriod;
  }

  get blocking(): boolean {
    return this.props.blocking;
  }

  /** Frees the dress's calendar (cancelled rental) while keeping the row. */
  unblock(now: Date): void {
    this.props.blocking = false;
    this.setUpdatedAt(now);
  }

  /** The rental's dates (or the cleaning buffer) moved: hold the dress for the new interval. */
  reblock(blockedPeriod: RentalPeriod, now: Date): void {
    this.props.blockedPeriod = blockedPeriod;
    this.setUpdatedAt(now);
  }

  /** A new agreement with the customer for this dress (FR-RENT-13). */
  reprice(price: Money, now: Date): void {
    this.props.price = price;
    this.setUpdatedAt(now);
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.dressId, 'dressId');
    this.guardAgainstEmpty(this.props.price, 'price');
    this.guardAgainstEmpty(this.props.blockedPeriod, 'blockedPeriod');
  }
}
