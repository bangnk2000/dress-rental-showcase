import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class CreateDressCommand extends Command {
  readonly code: string;
  readonly name: string;
  readonly sizeLabel: string | null;
  readonly rentalPrice: number;
  readonly depositAmount: number;
  readonly notes: string | null;
  readonly photoUrls: string[];
  readonly categoryId: string | null;
  readonly purchasePrice: number | null;
  /** From the verified JWT — the purchase-price field rule compares against it (FR-CAT-05). */
  readonly actorRole: 'owner' | 'staff';
  /** Who did it, for the price-history v1 row (FR-CAT-06); null = the seed import script. */
  readonly actorId: string | null;

  constructor(props: CommandProps<CreateDressCommand>) {
    super(props);
    this.code = props.code;
    this.name = props.name;
    this.sizeLabel = props.sizeLabel;
    this.rentalPrice = props.rentalPrice;
    this.depositAmount = props.depositAmount;
    this.notes = props.notes;
    this.photoUrls = props.photoUrls;
    this.categoryId = props.categoryId;
    this.purchasePrice = props.purchasePrice;
    this.actorRole = props.actorRole;
    this.actorId = props.actorId;
  }
}
