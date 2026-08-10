import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class UserReactivatedDomainEvent extends DomainEvent {
  constructor(props: DomainEventProps) {
    super(props);
  }
}
