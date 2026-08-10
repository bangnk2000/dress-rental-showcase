import { QueryBase } from '../../../../libs/ddd/query.base';

export class GetQrLinkQuery extends QueryBase {
  constructor(readonly qrLinkId: string) { super(); }
}
