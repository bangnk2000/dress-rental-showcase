import { PaginatedQueryBase, PaginatedQueryProps } from '../../../../libs/ddd/query.base';
import { RentalStatus } from '../../domain/rental.types';

export class ListRentalsQuery extends PaginatedQueryBase {
  readonly q?: string;
  readonly status?: RentalStatus;

  constructor(props: PaginatedQueryProps & { q?: string; status?: RentalStatus }) {
    super(props);
    this.q = props.q;
    this.status = props.status;
  }
}
