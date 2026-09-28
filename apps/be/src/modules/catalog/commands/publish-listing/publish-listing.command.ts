import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class PublishListingCommand extends Command {
  readonly listingId: string;

  constructor(props: CommandProps<PublishListingCommand>) {
    super(props);
    this.listingId = props.listingId;
  }
}
