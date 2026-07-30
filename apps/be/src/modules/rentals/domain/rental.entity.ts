import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';
import { RentalItemEntity } from './rental-item.entity';
import { RentalPeriod } from './rental-period.value-object';
import { CreateRentalProps, RentalProps, RentalStatus } from './rental.types';
import { RentalCreatedDomainEvent } from './events/rental-created.domain-event';

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
  }
}
