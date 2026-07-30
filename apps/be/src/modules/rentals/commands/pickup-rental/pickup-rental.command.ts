import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class PickupRentalCommand extends Command {
  readonly rentalId: string;

  constructor(props: CommandProps<PickupRentalCommand>) {
    super(props);
    this.rentalId = props.rentalId;
  }
}
