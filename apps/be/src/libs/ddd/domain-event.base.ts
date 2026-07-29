export interface DomainEventProps {
  aggregateId: string;
}

export abstract class DomainEvent {
  public readonly aggregateId: string;

  constructor(props: DomainEventProps) {
    this.aggregateId = props.aggregateId;
  }
}
