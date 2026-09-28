import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class SetListingDressesCommand extends Command {
  readonly listingId: string;
  /** The COMPLETE set of attached dresses (replaces the current one). */
  readonly dressIds: string[];

  constructor(props: CommandProps<SetListingDressesCommand>) {
    super(props);
    this.listingId = props.listingId;
    this.dressIds = props.dressIds;
  }
}
