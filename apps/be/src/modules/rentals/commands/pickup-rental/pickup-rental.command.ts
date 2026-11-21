import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class PickupRentalCommand extends Command {
  readonly rentalId: string;
  /**
   * FR-RENT-14: the deposit collected at the counter as the dresses go out (VND ≥ 1), recorded in
   * the same transaction. null = none brought — legal only when a deposit is already on file.
   */
  readonly depositCollected: number | null;

  constructor(props: CommandProps<PickupRentalCommand>) {
    super(props);
    this.rentalId = props.rentalId;
    this.depositCollected = props.depositCollected;
  }
}
