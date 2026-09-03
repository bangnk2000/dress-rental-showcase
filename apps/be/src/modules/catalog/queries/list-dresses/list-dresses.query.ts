import { StaffRole } from '../../../../libs/authz/authz.types';
import { PaginatedQueryBase, PaginatedQueryProps } from '../../../../libs/ddd/query.base';
import { DressStatus } from '../../domain/dress.types';

export class ListDressesQuery extends PaginatedQueryBase {
  readonly q?: string;
  readonly status?: DressStatus;
  readonly categoryId?: string;
  /** Shapes the response: purchasePrice exists on the wire ONLY for the owner (FR-CAT-05 R2). */
  readonly readerRole: StaffRole;

  constructor(
    props: PaginatedQueryProps & {
      q?: string;
      status?: DressStatus;
      categoryId?: string;
      readerRole: StaffRole;
    },
  ) {
    super(props);
    this.q = props.q;
    this.status = props.status;
    this.categoryId = props.categoryId;
    this.readerRole = props.readerRole;
  }
}
