import { QrcodeSvgRendererAdapter } from './qrcode-svg-renderer.adapter';

describe('QrcodeSvgRendererAdapter', () => {
  it('renders a branded SVG while keeping the QR library output separate from its decorations', async () => {
    const svg = await new QrcodeSvgRendererAdapter().renderSvg('https://example.com/x');

    expect(svg).toContain('viewBox="0 0 640 760"');
    expect(svg).toContain('stroke="#d20a47"');
    expect(svg).toContain('stroke="#f3a3bc"');
    expect(svg).toContain('Cảm ơn quý khách');
    expect(svg).toContain('<svg x="80" y="64" width="480" height="480"');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('https://');
  });
});
