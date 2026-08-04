import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { QrRendererPort } from '../application/ports/qr-renderer.port';

/** Keeps the qrcode package at the infrastructure edge. */
@Injectable()
export class QrcodeSvgRendererAdapter implements QrRendererPort {
  renderSvg(targetUrl: string): Promise<string> {
    return QRCode.toString(targetUrl, { type: 'svg', errorCorrectionLevel: 'M' });
  }
}
