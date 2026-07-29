import { PaginatedQueryBase, PaginatedQueryProps } from '../../../../libs/ddd/query.base';
import { DressStatus } from '../../domain/dress.types';

export class ListDressesQuery extends PaginatedQueryBase {
  readonly q?: string;
  readonly status?: DressStatus;

  constructor(props: PaginatedQueryProps & { q?: string; status?: DressStatus }) {
    super(props);
    this.q = props.q;
    this.status = props.status;
  }
}
