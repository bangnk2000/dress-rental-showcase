import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class CreateUserCommand extends Command {
  readonly username: string;
  readonly name: string;
  readonly password: string;

  constructor(props: CommandProps<CreateUserCommand>) {
    super(props);
    this.username = props.username;
    this.name = props.name;
    this.password = props.password;
  }
}
