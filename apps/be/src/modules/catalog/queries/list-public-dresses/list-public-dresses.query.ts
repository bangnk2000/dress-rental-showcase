import { QueryBase } from '../../../../libs/ddd/query.base';
import { Occasion } from '../../domain/occasion.value-object';

export class ListPublicDressesQuery extends QueryBase {
  readonly occasion?: Occasion;
  /** undefined = every visible listing (the web builds list, home and "related" from one call). */
  readonly limit?: number;

  constructor(props: { occasion?: Occasion; limit?: number }) {
    super();
    this.occasion = props.occasion;
    this.limit = props.limit;
  }
}
