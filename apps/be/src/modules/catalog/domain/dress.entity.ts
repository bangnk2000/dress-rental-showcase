import { Err, Ok, Result } from 'oxide.ts';
import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { Money } from '../../../libs/ddd/money.value-object';
import { CreateDressProps, DressProps, DressStatus } from './dress.types';
import { DressCode } from './dress-code.value-object';
import { DressAlreadyRetiredError } from './dress.errors';
import { DressCreatedDomainEvent } from './events/dress-created.domain-event';
import { DressRetiredDomainEvent } from './events/dress-retired.domain-event';

export class DressEntity extends AggregateRoot<DressProps> {
  /** Factory. Id + time injected by the application layer. */
  static create(create: CreateDressProps, id: string, now: Date): DressEntity {
    const props: DressProps = { ...create, status: 'active' };
    const dress = new DressEntity({ id, props, createdAt: now, updatedAt: now });
    dress.addEvent(new DressCreatedDomainEvent({ aggregateId: id, code: create.code.unpack() }));
    return dress;
  }

  get status(): DressStatus {
    return this.props.status;
  }

  updateDetails(
    update: {
      name: string;
      sizeLabel: string | null;
      rentalPrice: Money;
      depositAmount: Money;
      notes: string | null;
      photoUrls: string[];
    },
    now: Date,
  ): void {
    this.props.name = update.name;
    this.props.sizeLabel = update.sizeLabel;
    this.props.rentalPrice = update.rentalPrice;
    this.props.depositAmount = update.depositAmount;
    this.props.notes = update.notes;
    this.props.photoUrls = [...update.photoUrls];
    this.setUpdatedAt(now);
    this.validate();
  }

  /** The shop-assigned code is identity to staff — changing it is a deliberate, separate act. */
  changeCode(code: DressCode, now: Date): void {
    this.props.code = code;
    this.setUpdatedAt(now);
    this.validate();
  }

  retire(now: Date): Result<void, DressAlreadyRetiredError> {
    if (this.props.status === 'retired') return Err(new DressAlreadyRetiredError());
    this.props.status = 'retired';
    this.setUpdatedAt(now);
    this.addEvent(new DressRetiredDomainEvent({ aggregateId: this.id }));
    return Ok(undefined);
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.code, 'code');
    this.guardAgainstEmpty(this.props.name, 'name');
    this.guardAgainstEmpty(this.props.rentalPrice, 'rentalPrice');
    this.guardAgainstEmpty(this.props.depositAmount, 'depositAmount');
  }
}
