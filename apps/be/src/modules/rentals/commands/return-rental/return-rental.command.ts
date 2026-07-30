import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class ReturnRentalCommand extends Command {
  readonly rentalId: string;
  /** VND integers; null = nothing to record for that movement. */
  readonly lateFee: number | null;
  readonly damageFee: number | null;
  readonly depositRefund: number | null;
  readonly note: string | null;

  constructor(props: CommandProps<ReturnRentalCommand>) {
    super(props);
    this.rentalId = props.rentalId;
    this.lateFee = props.lateFee;
    this.damageFee = props.damageFee;
    this.depositRefund = props.depositRefund;
    this.note = props.note;
  }
}
