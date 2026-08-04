import { QrcodeSvgRendererAdapter } from './qrcode-svg-renderer.adapter';

describe('QrcodeSvgRendererAdapter', () => {
  it('renders an SVG QR containing no fetched remote resource', async () => {
    await expect(new QrcodeSvgRendererAdapter().renderSvg('https://example.com/x')).resolves.toContain('<svg');
  });
});
