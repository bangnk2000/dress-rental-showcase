import { StaffRole } from '../../../../libs/authz/authz.types';
import { QueryBase } from '../../../../libs/ddd/query.base';

export class GetDressQuery extends QueryBase {
  readonly dressId: string;
  /** Shapes the response: purchasePrice exists on the wire ONLY for the owner (FR-CAT-05 R2). */
  readonly readerRole: StaffRole;

  constructor(props: { dressId: string; readerRole: StaffRole }) {
    super();
    this.dressId = props.dressId;
    this.readerRole = props.readerRole;
  }
}
