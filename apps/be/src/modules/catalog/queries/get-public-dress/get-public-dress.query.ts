import { QueryBase } from '../../../../libs/ddd/query.base';

export class GetPublicDressQuery extends QueryBase {
  readonly slug: string;

  constructor(props: { slug: string }) {
    super();
    this.slug = props.slug;
  }
}
