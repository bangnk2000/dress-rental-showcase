import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class DeleteCategoryCommand extends Command {
  readonly categoryId: string;

  constructor(props: CommandProps<DeleteCategoryCommand>) {
    super(props);
    this.categoryId = props.categoryId;
  }
}
