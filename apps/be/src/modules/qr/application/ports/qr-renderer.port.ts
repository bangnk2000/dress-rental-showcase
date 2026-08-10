export const QR_RENDERER = Symbol('QR_RENDERER');

/** External QR library boundary. The domain/application pass only persisted target URLs. */
export interface QrRendererPort {
  renderSvg(targetUrl: string): Promise<string>;
}
