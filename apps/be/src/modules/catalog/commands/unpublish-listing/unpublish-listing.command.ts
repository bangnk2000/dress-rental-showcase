import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class UnpublishListingCommand extends Command {
  readonly listingId: string;

  constructor(props: CommandProps<UnpublishListingCommand>) {
    super(props);
    this.listingId = props.listingId;
  }
}
