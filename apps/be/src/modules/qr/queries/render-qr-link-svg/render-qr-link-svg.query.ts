import { QueryBase } from '../../../../libs/ddd/query.base';

export class RenderQrLinkSvgQuery extends QueryBase {
  constructor(readonly qrLinkId: string) { super(); }
}
