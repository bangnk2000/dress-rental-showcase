import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { getPublicDress, listPublicDresses, listRelatedDresses } from '@/api/mock/public-catalog';
import { renderWithProviders } from '@/test/render';

import { DressDetail, FeaturedCollection, RelatedDresses } from './index';

describe('FeaturedCollection (FR-WEB-01)', () => {
  test('every card links to its product page and shows the day price', async () => {
    const dresses = await listPublicDresses({ limit: 8 });
    renderWithProviders(<FeaturedCollection dresses={dresses} />);

    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(8);
    const first = within(cards[0]!);
    expect(first.getByRole('link', { name: 'Đầm Dạ Hội Lộng Lẫy' })).toHaveAttribute('href', '/bo-suu-tap/dam-da-hoi-long-lay');
    expect(first.getByText('350.000đ')).toBeInTheDocument();
    expect(first.getByText('2.800k')).toBeInTheDocument();
    expect(first.getByText('Có sẵn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem tất cả/ })).toHaveAttribute('href', '/bo-suu-tap');
  });

  test('a style chip filters the grid and is the only pressed chip', async () => {
    renderWithProviders(<FeaturedCollection dresses={await listPublicDresses({ limit: 8 })} />);

    const chips = within(screen.getByRole('group', { name: 'Lọc theo loại' }));
    expect(chips.getByRole('button', { name: 'Tất Cả Thiết Kế' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(chips.getByRole('button', { name: 'Váy ngắn' }));
    expect(chips.getByRole('button', { name: 'Váy ngắn' })).toHaveAttribute('aria-pressed', 'true');
    expect(chips.getByRole('button', { name: 'Tất Cả Thiết Kế' })).toHaveAttribute('aria-pressed', 'false');
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Váy Sinh Nhật / Prom', 'Váy Nơ Lưng Mini']);

    fireEvent.click(chips.getByRole('button', { name: 'Áo dài' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Áo Dài Cách Tân',
      'Áo Dài Lụa Hoạ Tiết',
    ]);
  });

  test('the heart toggles in place without leaving the card', async () => {
    renderWithProviders(<FeaturedCollection dresses={await listPublicDresses({ limit: 1 })} />);
    const heart = screen.getByRole('button', { name: 'Lưu Đầm Dạ Hội Lộng Lẫy' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DressDetail (FR-WEB-03)', () => {
  test('sizes are information: sold-out ones are announced, Zalo and call are the actions', async () => {
    const dress = (await getPublicDress('dam-da-hoi-long-lay'))!;
    renderWithProviders(<DressDetail dress={dress} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Đầm Dạ Hội Lộng Lẫy' })).toBeInTheDocument();
    const sizes = within(screen.getByRole('list', { name: 'Size' }));
    expect(sizes.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Hết size XS', 'S', 'M', 'Hết size L']);
    expect(screen.queryByRole('button', { name: /^(XS|S|M|L)$/ })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Nhắn Zalo giữ váy/ })).toHaveAttribute('href', 'https://zalo.me/0901000000');
    expect(screen.getByRole('link', { name: /Gọi 0901 000 000/ })).toHaveAttribute('href', 'tel:0901000000');
    expect(screen.getAllByText('Ren, tulle, hạt cườm đính tay')).toHaveLength(2);
  });

  test('specs are in the markup outside any <details> for md+, without JavaScript toggling', async () => {
    const dress = (await getPublicDress('dam-da-hoi-long-lay'))!;
    renderWithProviders(<DressDetail dress={dress} />);

    const [mobile, desktop] = screen.getAllByText('Ren, tulle, hạt cườm đính tay');
    expect(mobile?.closest('details')).not.toBeNull();
    expect(desktop?.closest('details')).toBeNull();
    expect(desktop?.closest('.md\\:block')).not.toBeNull();
  });

  test('a thumbnail selects its photo and moves the counter', async () => {
    const dress = (await getPublicDress('dam-da-hoi-long-lay'))!;
    renderWithProviders(<DressDetail dress={dress} />);

    expect(screen.getByText(`1 / ${dress.images.length}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh 2' }));
    expect(screen.getByRole('button', { name: 'Xem ảnh 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Xem ảnh 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(`2 / ${dress.images.length}`)).toBeInTheDocument();
  });

  test('related dresses link onwards and never include the dress itself', async () => {
    renderWithProviders(<RelatedDresses dresses={await listRelatedDresses('dam-da-hoi-long-lay')} />);
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).not.toContain('/bo-suu-tap/dam-da-hoi-long-lay');
    expect(links).toContain('/bo-suu-tap/dam-tulle-hong-phan');
  });
});
