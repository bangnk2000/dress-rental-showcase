import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ContactPage } from './index';

const stubClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('ContactPage (FR-WEB-04)', () => {
  afterEach(() => vi.restoreAllMocks());

  test('call, maps and every social channel are real outbound links', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('link', { name: /Gọi ngay/ })).toHaveAttribute('href', 'tel:0901000000');
    const maps = screen.getByRole('link', { name: /Mở Google Maps/ });
    expect(maps).toHaveAttribute('href', expect.stringContaining('maps.google.com'));
    expect(maps).toHaveAttribute('target', '_blank');
    for (const name of ['Facebook', 'Instagram', 'TikTok', 'Zalo']) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('copy address writes the full address and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    renderWithProviders(<ContactPage />);

    fireEvent.click(screen.getByRole('button', { name: /Sao chép địa chỉ/ }));
    expect(writeText).toHaveBeenCalledWith('12 Phố Mẫu, Q. Cầu Giấy, Hà Nội');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép địa chỉ'));
  });

  test('a refused clipboard tells the visitor instead of failing silently', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    renderWithProviders(<ContactPage />);

    fireEvent.click(screen.getByRole('button', { name: /Sao chép địa chỉ/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Không sao chép được'));
  });

  test.each([
    ['Mon 09:00 in Hà Nội', '2026-09-21T02:00:00Z', 'Showroom đã đóng cửa'],
    ['Mon 15:00 in Hà Nội', '2026-09-21T08:00:00Z', 'Showroom đang mở cửa'],
  ])('the showroom status follows the shop clock (%s)', async (_label, iso, text) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
    try {
      renderWithProviders(<ContactPage />);
      expect(await screen.findByText(text)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
