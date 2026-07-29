export abstract class QueryBase {}

export interface PaginatedQueryProps {
  limit?: number;
  page?: number;
}

export abstract class PaginatedQueryBase extends QueryBase {
  readonly limit: number;
  readonly page: number;

  get offset(): number {
    return (this.page - 1) * this.limit;
  }

  protected constructor(props: PaginatedQueryProps) {
    super();
    this.limit = Math.min(props.limit ?? 20, 100);
    this.page = Math.max(props.page ?? 1, 1);
  }
}

export class Paginated<T> {
  readonly data: readonly T[];
  readonly count: number;
  readonly limit: number;
  readonly page: number;

  constructor(props: { data: readonly T[]; count: number; limit: number; page: number }) {
    this.data = props.data;
    this.count = props.count;
    this.limit = props.limit;
    this.page = props.page;
  }
}
