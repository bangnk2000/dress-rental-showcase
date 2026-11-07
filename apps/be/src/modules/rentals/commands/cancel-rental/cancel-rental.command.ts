import { StaffRole } from '../../../../libs/authz/authz.types';
import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class CancelRentalCommand extends Command {
  readonly rentalId: string;
  /**
   * rentals/cancel-with-refund. The collected amounts the caller computed its refunds from; both
   * null = the caller makes no claim (an empty-ledger cancel). One given, the other null → 0.
   */
  readonly expectedDepositCollected: number | null;
  readonly expectedRentalFeeCollected: number | null;
  /** VND integers handed back; null = 0 (nothing handed back of that kind). */
  readonly depositRefund: number | null;
  readonly rentalFeeRefund: number | null;
  readonly note: string | null;
  /** From the verified JWT — decides whether money may be kept at all (§6.Q3). */
  readonly actorRole: StaffRole;

  constructor(props: CommandProps<CancelRentalCommand>) {
    super(props);
    this.rentalId = props.rentalId;
    this.expectedDepositCollected = props.expectedDepositCollected;
    this.expectedRentalFeeCollected = props.expectedRentalFeeCollected;
    this.depositRefund = props.depositRefund;
    this.rentalFeeRefund = props.rentalFeeRefund;
    this.note = props.note;
    this.actorRole = props.actorRole;
  }
}
