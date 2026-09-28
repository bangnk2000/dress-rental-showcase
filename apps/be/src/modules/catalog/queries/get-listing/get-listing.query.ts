import { QueryBase } from '../../../../libs/ddd/query.base';

export class GetListingQuery extends QueryBase {
  readonly listingId: string;

  constructor(props: { listingId: string }) {
    super();
    this.listingId = props.listingId;
  }
}
