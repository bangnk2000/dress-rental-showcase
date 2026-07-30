import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class CancelRentalCommand extends Command {
  readonly rentalId: string;

  constructor(props: CommandProps<CancelRentalCommand>) {
    super(props);
    this.rentalId = props.rentalId;
  }
}
