import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export interface CreateRentalItemInput {
  dressId: string;
  /** null = use the dress's standard rental price. */
  price: number | null;
}

export class CreateRentalCommand extends Command {
  readonly customerName: string;
  readonly customerPhone: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly notes: string | null;
  /** VND taken off the rental fee (FR-RENT-11); 0 = none. */
  readonly discountAmount: number;
  readonly items: readonly CreateRentalItemInput[];
  /** FR-RENT-14: money handed over at booking; null amounts = not collected. */
  readonly collect: { deposit: number | null; rentalFee: number | null };

  constructor(props: CommandProps<CreateRentalCommand>) {
    super(props);
    this.customerName = props.customerName;
    this.customerPhone = props.customerPhone;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.notes = props.notes;
    this.discountAmount = props.discountAmount;
    this.items = props.items;
    this.collect = props.collect;
  }
}
