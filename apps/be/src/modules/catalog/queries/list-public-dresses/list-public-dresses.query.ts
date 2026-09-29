import { QueryBase } from '../../../../libs/ddd/query.base';
import { Style } from '../../domain/style.value-object';

export class ListPublicDressesQuery extends QueryBase {
  readonly style?: Style;
  /** undefined = every visible listing (the web builds list, home and "related" from one call). */
  readonly limit?: number;

  constructor(props: { style?: Style; limit?: number }) {
    super();
    this.style = props.style;
    this.limit = props.limit;
  }
}
