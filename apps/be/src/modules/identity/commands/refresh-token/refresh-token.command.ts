import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class RefreshTokenCommand extends Command {
  readonly refreshToken: string;

  constructor(props: CommandProps<RefreshTokenCommand>) {
    super(props);
    this.refreshToken = props.refreshToken;
  }
}
