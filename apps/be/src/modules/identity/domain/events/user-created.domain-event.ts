import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class UserCreatedDomainEvent extends DomainEvent {
  public readonly username: string;

  constructor(props: DomainEventProps & { username: string }) {
    super(props);
    this.username = props.username;
  }
}
