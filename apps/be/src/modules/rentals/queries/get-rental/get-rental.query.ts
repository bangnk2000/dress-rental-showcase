import { QueryBase } from '../../../../libs/ddd/query.base';

export class GetRentalQuery extends QueryBase {
  readonly rentalId: string;

  constructor(props: { rentalId: string }) {
    super();
    this.rentalId = props.rentalId;
  }
}
