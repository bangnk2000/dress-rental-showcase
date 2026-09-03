import { Command, CommandProps } from '../../../../libs/ddd/command.base';

/**
 * Partial update: `undefined` = keep the current value; explicit `null`
 * clears a nullable field (sizeLabel, notes).
 */
export class UpdateDressCommand extends Command {
  readonly dressId: string;
  readonly code?: string;
  readonly name?: string;
  readonly sizeLabel?: string | null;
  readonly rentalPrice?: number;
  readonly depositAmount?: number;
  readonly notes?: string | null;
  readonly photoUrls?: string[];
  readonly categoryId?: string | null;
  readonly purchasePrice?: number | null;
  /** From the verified JWT — the purchase-price field rule compares against it (FR-CAT-05). */
  readonly actorRole: 'owner' | 'staff';
  /** Who did it, for the price-history row when the prices change (FR-CAT-06). */
  readonly actorId: string | null;

  constructor(props: CommandProps<UpdateDressCommand>) {
    super(props);
    this.dressId = props.dressId;
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
