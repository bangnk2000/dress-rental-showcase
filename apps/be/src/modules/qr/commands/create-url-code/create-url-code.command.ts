import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class CreateUrlCodeCommand extends Command {
  readonly targetUrl: string;
  readonly label: string | null;
  readonly createdByStaffId: string;

  constructor(props: CommandProps<CreateUrlCodeCommand>) {
    super(props);
    this.targetUrl = props.targetUrl;
    this.label = props.label;
    this.createdByStaffId = props.createdByStaffId;
  }
}
