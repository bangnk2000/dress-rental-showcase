import { StaffRole } from '../../../../libs/authz/authz.types';
import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class DeleteListingCommand extends Command {
  readonly listingId: string;
  /** From the verified JWT — R8 decides on it (staff: only never-published listings). */
  readonly actorRole: StaffRole;

  constructor(props: CommandProps<DeleteListingCommand>) {
    super(props);
    this.listingId = props.listingId;
    this.actorRole = props.actorRole;
  }
}
