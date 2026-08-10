import { TargetUrl } from './target-url.value-object';

export interface QrLinkProps {
  targetUrl: TargetUrl;
  label: string | null;
  createdByStaffId: string;
}

export interface CreateQrLinkProps extends QrLinkProps {}
