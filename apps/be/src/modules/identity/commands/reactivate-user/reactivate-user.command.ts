import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class ReactivateUserCommand extends Command {
  readonly userId: string;

  constructor(props: CommandProps<ReactivateUserCommand>) {
    super(props);
    this.userId = props.userId;
  }
}
