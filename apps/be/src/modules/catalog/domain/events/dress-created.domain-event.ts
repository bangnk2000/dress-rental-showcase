import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class DressCreatedDomainEvent extends DomainEvent {
  public readonly code: string;

  constructor(props: DomainEventProps & { code: string }) {
    super(props);
    this.code = props.code;
  }
}
