import { AggregateRoot } from '../../../libs/ddd/aggregate-root.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';
import { PaymentRecordedDomainEvent } from './events/payment-recorded.domain-event';
import { CreatePaymentProps, PaymentProps } from './payment.types';

/**
 * ONE money movement of a rental. The ledger is append-only by business rule (FR-PAY-02 R6):
 * there is no method that changes an amount, and there never should be one without an owner
 * decision on who may correct a movement and how it stays auditable.
 */
export class PaymentEntity extends AggregateRoot<PaymentProps> {
  /** Factory for money COLLECTED. Id + time injected by the application layer. */
  static record(create: CreatePaymentProps, id: string, now: Date): PaymentEntity {
    const payment = new PaymentEntity({ id, props: create, createdAt: now, updatedAt: now });
    payment.addEvent(
      new PaymentRecordedDomainEvent({
        aggregateId: id,
        rentalId: create.rentalId,
        kind: create.kind,
        amount: create.amount.amount,
      }),
    );
    return payment;
  }

  get rentalId(): string {
    return this.props.rentalId;
  }

  get kind(): PaymentProps['kind'] {
    return this.props.kind;
  }

  get amount(): number {
    return this.props.amount.amount;
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.rentalId, 'rentalId');
    this.guardAgainstEmpty(this.props.kind, 'kind');
    // Money already refuses negatives and decimals (BR-4); a 0₫ row would be a movement that
    // never happened — "not collected" is the ABSENCE of a row, not a zero one (R2).
    if (this.props.amount.amount < 1) {
      throw new ArgumentInvalidException('A payment movement must be at least 1 VND');
    }
  }
}
