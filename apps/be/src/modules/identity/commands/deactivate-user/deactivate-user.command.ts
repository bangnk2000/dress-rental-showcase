import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class DeactivateUserCommand extends Command {
  readonly userId: string;
  /** From the verified JWT — the self-lock rule compares against it. */
  readonly actorId: string;

  constructor(props: CommandProps<DeactivateUserCommand>) {
    super(props);
    this.userId = props.userId;
    this.actorId = props.actorId;
  }
}
