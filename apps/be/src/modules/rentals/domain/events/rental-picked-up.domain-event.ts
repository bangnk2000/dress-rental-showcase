import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class RentalPickedUpDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps) {
    super(props);
  }
}
