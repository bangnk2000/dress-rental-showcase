import { Err, Ok, Result } from 'oxide.ts';
import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';
import { Money } from '../../../libs/ddd/money.value-object';
import { LateFeeQuote } from './late-fee.value-object';
import { RentalItemEntity } from './rental-item.entity';
import { RentalPeriod } from './rental-period.value-object';
import { CreateRentalProps, RentalProps, RentalStatus } from './rental.types';
import { RentalCancelledDomainEvent } from './events/rental-cancelled.domain-event';
import { RentalCreatedDomainEvent } from './events/rental-created.domain-event';
import { RentalPickedUpDomainEvent } from './events/rental-picked-up.domain-event';
import { RentalReturnedDomainEvent } from './events/rental-returned.domain-event';
import {
  RentalCancelNotAllowedError,
  RentalPickupNotAllowedError,
  RentalReturnNotAllowedError,
} from './rental.errors';

export class RentalEntity extends AggregateRoot<RentalProps> {
  /**
   * Factory. Ids + time injected by the application layer. Every item blocks
   * the dress for the rental period PLUS the cleaning buffer; the Postgres
   * EXCLUDE constraint enforces the same interval at the DB level.
   */
  static create(
    create: CreateRentalProps,
    id: string,
    now: Date,
    cleaningBufferDays: number,
  ): RentalEntity {
    const blockedPeriod = create.period.extendEndByDays(cleaningBufferDays);
    const items = create.items.map((item) =>
      RentalItemEntity.create({ ...item, blockedPeriod }, now),
    );
    const props: RentalProps = {
      customerName: create.customerName,
      customerPhone: create.customerPhone,
      period: create.period,
      status: 'booked',
      notes: create.notes,
      discount: create.discount,
      items,
    };
    const rental = new RentalEntity({ id, props, createdAt: now, updatedAt: now });
    rental.addEvent(
      new RentalCreatedDomainEvent({
        aggregateId: id,
        dressIds: items.map((item) => item.dressId),
      }),
    );
    return rental;
  }

  get status(): RentalStatus {
    return this.props.status;
  }

  get period(): RentalPeriod {
    return this.props.period;
  }

  get items(): readonly RentalItemEntity[] {
    return this.props.items;
  }

  get discount(): Money {
    return this.props.discount;
  }

  /** Σ item prices — the rental fee BEFORE the discount. */
  get itemsTotal(): Money {
    return Money.create(this.props.items.reduce((sum, item) => sum + item.price.amount, 0));
  }

  /**
   * FR-RENT-09: what the shop should charge if the dresses come back on `referenceDate`.
   * The rule lives in the domain (LateFeeQuote) and is priced per DRESS, so it belongs to the
   * aggregate that knows how many dresses the rental holds.
   */
  lateFeeQuote(referenceDate: string, dailyRateAmount: number): LateFeeQuote {
    return LateFeeQuote.compute({
      dueDate: this.props.period.end,
      referenceDate,
      dressCount: this.props.items.length,
      dailyRateAmount,
    });
  }

  /** Staff hands the dresses to the customer: booked → out. */
  markPickedUp(now: Date): Result<void, RentalPickupNotAllowedError> {
    if (this.props.status !== 'booked') {
      return Err(new RentalPickupNotAllowedError(this.props.status));
    }
    this.props.status = 'out';
    this.setUpdatedAt(now);
    this.addEvent(new RentalPickedUpDomainEvent({ aggregateId: this.id }));
    return Ok(undefined);
  }

  /**
   * Customer brings the dresses back: out → returned, ONLY. A rental that was never handed
   * over has nothing to take back — settling it would record money for a handover that never
   * happened (FR-RENT-10 R1; the old booked→returned shortcut is deliberately gone). The items
   * keep blocking through the cleaning buffer, which IS the derived "cleaning" state.
   */
  markReturned(now: Date): Result<void, RentalReturnNotAllowedError> {
    if (this.props.status !== 'out') {
      return Err(new RentalReturnNotAllowedError(this.props.status));
    }
    this.props.status = 'returned';
    this.setUpdatedAt(now);
    this.addEvent(new RentalReturnedDomainEvent({ aggregateId: this.id }));
    return Ok(undefined);
  }

  /**
   * Cancel: booked|out → cancelled, and every item stops blocking — the calendar frees for
   * re-booking while the rows stay as history. An OUT rental may cancel only while its ledger
   * is EMPTY (a mis-created born-out rental, FR-RENT-10 §6.Q2) — that money rule lives in the
   * application/repository layer, since the aggregate cannot see the payments table.
   */
  cancel(now: Date): Result<void, RentalCancelNotAllowedError> {
    if (this.props.status !== 'booked' && this.props.status !== 'out') {
      return Err(new RentalCancelNotAllowedError(this.props.status));
    }
    this.props.status = 'cancelled';
    for (const item of this.props.items) {
      item.unblock(now);
    }
    this.setUpdatedAt(now);
    this.addEvent(new RentalCancelledDomainEvent({ aggregateId: this.id }));
    return Ok(undefined);
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.customerName, 'customerName');
    this.guardAgainstEmpty(this.props.customerPhone, 'customerPhone');
    this.guardAgainstEmpty(this.props.period, 'period');
    this.guardAgainstEmpty(this.props.items, 'items');
    const dressIds = this.props.items.map((item) => item.dressId);
    if (new Set(dressIds).size !== dressIds.length) {
      // Backs the DTO-level ArrayUnique and the DB UNIQUE (rental_id, dress_id).
      throw new ArgumentInvalidException('A rental must not list the same dress twice');
    }
    this.guardAgainstEmpty(this.props.discount, 'discount');
    if (this.props.discount.amount > this.itemsTotal.amount) {
      // FR-RENT-11 R2: a discount larger than the fee is a typo, not a business case. The rule
      // spans two tables, so the aggregate is the only place that can hold it (the DB CHECK only
      // refuses a negative amount).
      throw new ArgumentInvalidException('Discount must not exceed the sum of the item prices');
    }
  }
}
