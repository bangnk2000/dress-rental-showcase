import { QueryBase } from '../../../../libs/ddd/query.base';

export class ListPriceHistoryQuery extends QueryBase {
  readonly dressId: string;

  constructor(props: { dressId: string }) {
    super();
    this.dressId = props.dressId;
  }
}
