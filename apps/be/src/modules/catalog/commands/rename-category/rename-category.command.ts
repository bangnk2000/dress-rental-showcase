import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class RenameCategoryCommand extends Command {
  readonly categoryId: string;
  readonly name: string;

  constructor(props: CommandProps<RenameCategoryCommand>) {
    super(props);
    this.categoryId = props.categoryId;
    this.name = props.name;
  }
}
