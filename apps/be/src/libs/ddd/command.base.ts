import { randomUUID } from 'node:crypto';

export type CommandProps<T> = Omit<T, 'id'> & Partial<Command>;

export abstract class Command {
  /** Command id, for logging/idempotency correlation. */
  readonly id: string;

  constructor(props: CommandProps<unknown>) {
    this.id = props.id ?? randomUUID();
  }
}
