import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class CategoryCreatedDomainEvent extends DomainEvent {
  public readonly name: string;

  constructor(props: DomainEventProps & { name: string }) {
    super(props);
    this.name = props.name;
  }
}
