import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export interface UpdateRentalItemInput {
  dressId: string;
  /** null = keep the agreed price of a kept dress, or the standard price for an added one. */
  price: number | null;
}

/**
 * FR-RENT-13: rewrite the content of an open rental. Every field is optional — `undefined`
 * keeps the current value. `items`, when present, is the FULL new list (replace).
 */
export class UpdateRentalCommand extends Command {
  readonly rentalId: string;
  readonly customerName: string | undefined;
  readonly customerPhone: string | undefined;
  readonly startDate: string | undefined;
  readonly endDate: string | undefined;
  /** undefined = keep; null = clear. */
  readonly notes: string | null | undefined;
  readonly discountAmount: number | undefined;
  readonly items: readonly UpdateRentalItemInput[] | undefined;

  constructor(props: CommandProps<UpdateRentalCommand>) {
    super(props);
    this.rentalId = props.rentalId;
    this.customerName = props.customerName;
    this.customerPhone = props.customerPhone;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.notes = props.notes;
    this.discountAmount = props.discountAmount;
    this.items = props.items;
  }
}
