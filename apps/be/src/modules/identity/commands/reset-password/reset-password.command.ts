import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class ResetPasswordCommand extends Command {
  readonly userId: string;
  readonly newPassword: string;

  constructor(props: CommandProps<ResetPasswordCommand>) {
    super(props);
    this.userId = props.userId;
    this.newPassword = props.newPassword;
  }
}
