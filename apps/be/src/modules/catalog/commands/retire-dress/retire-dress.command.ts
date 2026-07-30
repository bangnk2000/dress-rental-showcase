import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class RetireDressCommand extends Command {
  readonly dressId: string;

  constructor(props: CommandProps<RetireDressCommand>) {
    super(props);
    this.dressId = props.dressId;
  }
}
