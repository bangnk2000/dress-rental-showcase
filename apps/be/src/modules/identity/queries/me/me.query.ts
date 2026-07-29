import { QueryBase } from '../../../../libs/ddd/query.base';

export class MeQuery extends QueryBase {
  constructor(readonly staffId: string) {
    super();
  }
}
