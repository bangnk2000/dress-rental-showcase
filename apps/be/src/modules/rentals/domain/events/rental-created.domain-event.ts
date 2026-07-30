import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

export class RentalCreatedDomainEvent extends DomainEvent {
  public readonly dressIds: string[];

  constructor(props: DomainEventProps & { dressIds: string[] }) {
    super(props);
    this.dressIds = props.dressIds;
  }
}
