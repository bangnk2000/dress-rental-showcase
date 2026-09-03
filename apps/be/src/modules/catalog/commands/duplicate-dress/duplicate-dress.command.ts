import { Command, CommandProps } from '../../../../libs/ddd/command.base';

/**
 * FR-CAT-08: a copy of an existing dress under the next free `<base>_<n>` code — the way the shop
 * records the same model in another size. Everything but the code and (optionally) the size is
 * taken from the source.
 */
export class DuplicateDressCommand extends Command {
  readonly sourceDressId: string;
  /** undefined = keep the source's size; null = the copy has none; string = the copy's size. */
  readonly sizeLabel: string | null | undefined;
  /** Who did it, for the price-history v1 row of the copy (FR-CAT-06). */
  readonly actorId: string | null;

  constructor(props: CommandProps<DuplicateDressCommand>) {
    super(props);
    this.sourceDressId = props.sourceDressId;
    this.sizeLabel = props.sizeLabel;
    this.actorId = props.actorId;
  }
}
