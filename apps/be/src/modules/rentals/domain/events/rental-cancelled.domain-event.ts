import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class RentalCancelledDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps) {
    super(props);
  }
}
