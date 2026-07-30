import { QueryBase } from '../../../../libs/ddd/query.base';

export class GetTodayBoardQuery extends QueryBase {
  /** Board date (yyyy-mm-dd); null = the server's current date. */
  readonly date: string | null;

  constructor(props: { date: string | null }) {
    super();
    this.date = props.date;
  }
}
