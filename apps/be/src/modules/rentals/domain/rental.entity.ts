import { Err, Ok, Result } from 'oxide.ts';
import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';
import { Money } from '../../../libs/ddd/money.value-object';
import { LateFeeQuote } from './late-fee.value-object';
import { RentalItemEntity } from './rental-item.entity';
import { RentalPeriod } from './rental-period.value-object';
import {
  CreateRentalProps,
  RentalProps,
  RentalStatus,
  UpdateRentalProps,
} from './rental.types';
import { RentalCancelledDomainEvent } from './events/rental-cancelled.domain-event';
import { RentalCreatedDomainEvent } from './events/rental-created.domain-event';
import { RentalPickedUpDomainEvent } from './events/rental-picked-up.domain-event';
import { RentalReturnedDomainEvent } from './events/rental-returned.domain-event';
import { RentalUpdatedDomainEvent } from './events/rental-updated.domain-event';
import {
  RentalCancelNotAllowedError,
  RentalPickupNotAllowedError,
  RentalReturnNotAllowedError,
  RentalUpdateNotAllowedError,
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

  /** booked|out — the rental still has a future: money can be recorded and content edited. */
  get isOpen(): boolean {
    return this.props.status === 'booked' || this.props.status === 'out';
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

  get cancelReason(): string | null {
    return this.props.cancelReason ?? null;
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
  cancel(now: Date, reason: string | null = null): Result<void, RentalCancelNotAllowedError> {
    if (this.props.status !== 'booked' && this.props.status !== 'out') {
      return Err(new RentalCancelNotAllowedError(this.props.status));
    }
    this.props.status = 'cancelled';
    this.props.cancelReason = reason;
    for (const item of this.props.items) {
      item.unblock(now);
    }
    this.setUpdatedAt(now);
    this.addEvent(new RentalCancelledDomainEvent({ aggregateId: this.id }));
    return Ok(undefined);
  }

  /**
   * FR-RENT-13: the owner rewrites the CONTENT of an open rental — never its status, which
   * pickup/return/cancel own (an edit that moves the start to today is not a handover: §6.Q3).
   *
   * Items are reconciled by id: a kept dress keeps its row and takes the given price, an added
   * dress gets a fresh row, a dress missing from the list is dropped. Afterwards EVERY item blocks
   * the (new) period + the CURRENT cleaning buffer (§6.Q9) — the interval the EXCLUDE constraint
   * guards; the availability pre-check for it lives in the application layer, which can see other
   * rentals. `validate()` runs again at the end: a discount above the new item total throws and
   * nothing is persisted.
   */
  update(
    changes: UpdateRentalProps,
    now: Date,
    cleaningBufferDays: number,
  ): Result<void, RentalUpdateNotAllowedError> {
    if (!this.isOpen) {
      return Err(new RentalUpdateNotAllowedError(this.props.status));
    }
    if (changes.customerName !== undefined) this.props.customerName = changes.customerName;
    if (changes.customerPhone !== undefined) this.props.customerPhone = changes.customerPhone;
    if (changes.period !== undefined) this.props.period = changes.period;
    if (changes.notes !== undefined) this.props.notes = changes.notes;
    if (changes.discount !== undefined) this.props.discount = changes.discount;

    const blockedPeriod = this.props.period.extendEndByDays(cleaningBufferDays);
    if (changes.items !== undefined) {
      const current = new Map(this.props.items.map((item) => [item.id, item]));
      this.props.items = changes.items.map((input) => {
        const kept = current.get(input.id);
        if (kept) {
          kept.reprice(input.price, now);
          return kept;
        }
        return RentalItemEntity.create({ ...input, blockedPeriod }, now);
      });
    }
    for (const item of this.props.items) {
      item.reblock(blockedPeriod, now);
    }
    this.setUpdatedAt(now);
    this.validate();
    this.addEvent(
      new RentalUpdatedDomainEvent({
        aggregateId: this.id,
        dressIds: this.props.items.map((item) => item.dressId),
      }),
    );
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
