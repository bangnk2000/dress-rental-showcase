import { QueryBase } from '../../../../libs/ddd/query.base';

export class ListQrLinksQuery extends QueryBase {
  readonly page: number;
  readonly limit: number;

  constructor(props: { page?: number; limit?: number }) {
    super();
    this.page = props.page ?? 1;
    this.limit = props.limit ?? 20;
  }

  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}
