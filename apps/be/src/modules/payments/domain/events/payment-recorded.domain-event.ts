import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';
import { CollectionKind } from '../payment.types';

export class PaymentRecordedDomainEvent extends DomainEvent {
  public readonly rentalId: string;
  public readonly kind: CollectionKind;
  public readonly amount: number;

  constructor(props: DomainEventProps & { rentalId: string; kind: CollectionKind; amount: number }) {
    super(props);
    this.rentalId = props.rentalId;
    this.kind = props.kind;
    this.amount = props.amount;
  }
}
