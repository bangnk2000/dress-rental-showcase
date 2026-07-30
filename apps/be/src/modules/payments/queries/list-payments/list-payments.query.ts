import { QueryBase } from '../../../../libs/ddd/query.base';

export class ListPaymentsQuery extends QueryBase {
  readonly rentalId: string;

  constructor(props: { rentalId: string }) {
    super();
    this.rentalId = props.rentalId;
  }
}
