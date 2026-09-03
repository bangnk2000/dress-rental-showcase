import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class CreateCategoryCommand extends Command {
  readonly name: string;

  constructor(props: CommandProps<CreateCategoryCommand>) {
    super(props);
    this.name = props.name;
  }
}
