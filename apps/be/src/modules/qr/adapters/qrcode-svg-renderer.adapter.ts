import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { QrRendererPort } from '../application/ports/qr-renderer.port';

/** Keeps the qrcode package at the infrastructure edge. */
@Injectable()
export class QrcodeSvgRendererAdapter implements QrRendererPort {
  async renderSvg(targetUrl: string): Promise<string> {
    const qrSvg = await QRCode.toString(targetUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 3,
      color: { dark: '#d20a47', light: '#ffffff' },
    });

    // The QR itself remains an untouched library-generated SVG. Decorations live outside
    // its quiet zone, so they cannot change the encoded modules or reduce scan reliability.
    const positionedQrSvg = qrSvg.replace('<svg ', '<svg x="80" y="64" width="480" height="480" ');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 760" role="img" aria-label="Mã QR cảm ơn quý khách">
  <rect width="640" height="760" fill="#ffffff"/>
  <rect x="64" y="48" width="512" height="512" rx="34" fill="none" stroke="#f3a3bc" stroke-width="7"/>
  ${positionedQrSvg}
  <g stroke="#f3a3bc" stroke-width="3" stroke-linecap="round">
    <path d="M132 560v58"/><path d="M232 560v34"/><path d="M320 560v65"/><path d="M408 560v34"/><path d="M508 560v58"/>
  </g>
  <g>
    <path fill="#d20a47" d="M132 666c-38-24-42-50-26-62 13-10 27-2 26 10-1-12 13-20 26-10 16 12 12 38-26 62Z"/>
    <path fill="#e73968" d="M232 626c-25-16-28-34-17-42 8-6 17-2 17 7 0-9 9-13 17-7 11 8 8 26-17 42Z"/>
    <path fill="#e73968" d="M320 685c-38-24-42-50-26-62 13-10 27-2 26 10-1-12 13-20 26-10 16 12 12 38-26 62Z"/>
    <path fill="#c40b45" d="M408 626c-25-16-28-34-17-42 8-6 17-2 17 7 0-9 9-13 17-7 11 8 8 26-17 42Z"/>
    <path fill="#ef5b7e" d="M508 666c-38-24-42-50-26-62 13-10 27-2 26 10-1-12 13-20 26-10 16 12 12 38-26 62Z"/>
  </g>
  <text x="320" y="730" fill="#c40b45" font-family="Arial, sans-serif" font-size="28" font-weight="600" text-anchor="middle">Cảm ơn quý khách</text>
</svg>`;
  }
}
