import { DomainEvent, DomainEventProps } from '../../../../libs/ddd/domain-event.base';

/** FR-RENT-13: the owner rewrote the content of an open rental (dates, dresses, customer, money terms). */
export class RentalUpdatedDomainEvent extends DomainEvent {
  /** The dresses on the rental AFTER the edit. */
  public readonly dressIds: string[];

  constructor(props: DomainEventProps & { dressIds: string[] }) {
    super(props);
    this.dressIds = props.dressIds;
  }
}
