import { QueryBase } from '../../../../libs/ddd/query.base';

export class CheckAvailabilityQuery extends QueryBase {
  readonly dressId: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(props: { dressId: string; startDate: string; endDate: string }) {
    super();
    this.dressId = props.dressId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
  }
}
