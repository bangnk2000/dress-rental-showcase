import { Command, CommandProps } from '../../../../libs/ddd/command.base';

export class RecordCollectionCommand extends Command {
  readonly rentalId: string;
  /** VND collected as deposit; null = not part of this recording. */
  readonly deposit: number | null;
  /** VND collected as the rental fee; null = not part of this recording. */
  readonly rentalFee: number | null;
  readonly note: string | null;

  constructor(props: CommandProps<RecordCollectionCommand>) {
    super(props);
    this.rentalId = props.rentalId;
    this.deposit = props.deposit;
    this.rentalFee = props.rentalFee;
    this.note = props.note;
  }
}
