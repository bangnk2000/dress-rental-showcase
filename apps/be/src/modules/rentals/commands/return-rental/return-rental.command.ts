import { StaffRole } from '../../../../libs/authz/authz.types';
import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class ReturnRentalCommand extends Command {
  readonly rentalId: string;
  /**
   * VND integer, or null = "charge the suggested late fee" (FR-RENT-09). This is the field whose
   * meaning changed: before FR-RENT-09, null meant "record nothing".
   */
  readonly lateFee: number | null;
  /** VND integers; null = nothing to record for that movement. */
  readonly damageFee: number | null;
  readonly depositRefund: number | null;
  readonly note: string | null;
  /** From the verified JWT — decides whether a waiver is allowed at all. */
  readonly actorRole: StaffRole;

  constructor(props: CommandProps<ReturnRentalCommand>) {
    super(props);
    this.rentalId = props.rentalId;
    this.lateFee = props.lateFee;
    this.damageFee = props.damageFee;
    this.depositRefund = props.depositRefund;
    this.note = props.note;
    this.actorRole = props.actorRole;
  }
}
