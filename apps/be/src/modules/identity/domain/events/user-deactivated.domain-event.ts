import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class UserDeactivatedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps) {
    super(props);
  }
}
