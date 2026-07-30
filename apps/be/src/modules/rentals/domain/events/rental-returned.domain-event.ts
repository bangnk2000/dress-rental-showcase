import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class RentalReturnedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps) {
    super(props);
  }
}
