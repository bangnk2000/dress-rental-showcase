import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { fixtureDresses, fixtureSummaries } from '@/test/fixtures/public-dresses';
import { renderWithProviders } from '@/test/render';

import { DressDetail, FeaturedCollection, RelatedDresses, relatedDresses } from './index';

const longLay = fixtureDresses[0]!;

describe('FeaturedCollection (FR-WEB-01)', () => {
  test('every card links to its product page and shows the day price', () => {
    const dresses = fixtureSummaries.slice(0, 8);
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

  test('a style chip filters the grid and is the only pressed chip', () => {
    renderWithProviders(<FeaturedCollection dresses={fixtureSummaries.slice(0, 8)} />);

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

  test('the heart toggles in place without leaving the card', () => {
    renderWithProviders(<FeaturedCollection dresses={fixtureSummaries.slice(0, 1)} />);
    const heart = screen.getByRole('button', { name: 'Lưu Đầm Dạ Hội Lộng Lẫy' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DressDetail (FR-WEB-03)', () => {
  test('sizes are information: sold-out ones are announced, Zalo and call are the actions', () => {
    const dress = longLay;
    renderWithProviders(<DressDetail dress={dress} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Đầm Dạ Hội Lộng Lẫy' })).toBeInTheDocument();
    const sizes = within(screen.getByRole('list', { name: 'Size' }));
    expect(sizes.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Hết size XS', 'S', 'M', 'Hết size L']);
    expect(screen.queryByRole('button', { name: /^(XS|S|M|L)$/ })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Nhắn Zalo giữ váy/ })).toHaveAttribute('href', 'https://zalo.me/0901000000');
    expect(screen.getByRole('link', { name: /Gọi 0901 000 000/ })).toHaveAttribute('href', 'tel:0901000000');
    expect(screen.getAllByText('Ren, tulle, hạt cườm đính tay')).toHaveLength(2);
  });

  test('specs are in the markup outside any <details> for md+, without JavaScript toggling', () => {
    const dress = longLay;
    renderWithProviders(<DressDetail dress={dress} />);

    const [mobile, desktop] = screen.getAllByText('Ren, tulle, hạt cườm đính tay');
    expect(mobile?.closest('details')).not.toBeNull();
    expect(desktop?.closest('details')).toBeNull();
    expect(desktop?.closest('.md\\:block')).not.toBeNull();
  });

  test('a thumbnail selects its photo and moves the counter', () => {
    const dress = longLay;
    renderWithProviders(<DressDetail dress={dress} />);

    expect(screen.getByText(`1 / ${dress.images.length}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh 2' }));
    expect(screen.getByRole('button', { name: 'Xem ảnh 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Xem ảnh 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(`2 / ${dress.images.length}`)).toBeInTheDocument();
  });

  test('related dresses link onwards and never include the dress itself', () => {
    renderWithProviders(<RelatedDresses dresses={relatedDresses(fixtureSummaries, longLay)} />);
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).not.toContain('/bo-suu-tap/dam-da-hoi-long-lay');
    expect(links).toContain('/bo-suu-tap/dam-tulle-hong-phan');
  });
});

describe('live DTO shape (web:public-catalog-live)', () => {
  const multi = { ...fixtureSummaries[4]!, slug: 'lua-ngan', name: 'Lụa Ngắn', styles: ['silk', 'short'] as const, retailPrice: null };

  test('a card names every style from the catalogue, shows the price per day, and hides a missing retail price', () => {
    renderWithProviders(<FeaturedCollection dresses={[{ ...multi, styles: [...multi.styles] }]} />);
    const card = within(screen.getByRole('listitem'));
    expect(card.getByText('Váy lụa, Váy ngắn')).toBeInTheDocument();
    expect(card.getByText('/ngày')).toBeInTheDocument();
    expect(card.queryByText(/k$/)).not.toBeInTheDocument();
  });

  test('a chip matches a dress carrying that style among others', () => {
    renderWithProviders(<FeaturedCollection dresses={[...fixtureSummaries.slice(0, 2), { ...multi, styles: [...multi.styles] }]} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Lọc theo loại' })).getByRole('button', { name: 'Váy ngắn' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Lụa Ngắn']);
  });

  test('empty spec cells are not rendered; all empty hides the section', () => {
    const specs = { material: 'Lụa', silhouette: null, length: null, color: null, styles: null };
    const { unmount } = renderWithProviders(<DressDetail dress={{ ...longLay, specs }} />);
    expect(screen.getAllByText('Chất liệu')).toHaveLength(2);
    expect(screen.queryByText('Dáng')).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<DressDetail dress={{ ...longLay, specs: { ...specs, material: null } }} />);
    expect(screen.queryByText('Chi tiết thiết kế')).not.toBeInTheDocument();
  });

  test('related: shared style first, then the rest, capped, never itself', () => {
    const related = relatedDresses(fixtureSummaries, longLay);
    expect(related).toHaveLength(4);
    expect(related[0]?.slug).toBe('dam-tulle-hong-phan');
    expect(related.map((d) => d.slug)).not.toContain(longLay.slug);
    expect(relatedDresses(fixtureSummaries, longLay, 2)).toHaveLength(2);
  });
});
