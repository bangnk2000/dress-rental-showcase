import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fixtureSummaries } from '@/test/fixtures/public-dresses';
import { renderWithProviders } from '@/test/render';

import { CatalogBrowser } from './components/dress-collection';
import { filterDresses, searchDresses } from './lib/filters';

const names = () => screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const type = (value: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm mẫu váy' }), { target: { value } });
const input = () => screen.getByRole('searchbox', { name: 'Tìm mẫu váy' });

describe('public search matching (AC1)', () => {
  test('Vietnamese accents, Đ, uppercase, whitespace and terms across both fields', () => {
    const dress = { ...fixtureSummaries[0]!, name: 'Đầm ĐỎ', tagline: 'Lụa mềm' };
    expect(searchDresses([dress], '  LUA\t dam DO  ')).toEqual([dress]);
    expect(searchDresses([dress], 'ĐẦM lụa')).toEqual([dress]);
    expect(searchDresses(fixtureSummaries, 'AO DAI')).toHaveLength(2);
    expect(searchDresses([dress], 'xanh')).toEqual([]);
  });

  test('empty queries preserve order; special characters are literal; private fields/slug are ignored', () => {
    const dress = { ...fixtureSummaries[0]!, name: 'Đầm [đỏ]', tagline: 'Lụa (mềm)', description: 'secret', slug: 'private' };
    expect(searchDresses([dress], '[do] (mem)')).toEqual([dress]);
    expect(searchDresses([dress], '.*')).toEqual([]);
    expect(searchDresses([dress], 'secret')).toEqual([]);
    expect(searchDresses([dress], 'private')).toEqual([]);
    expect(searchDresses(fixtureSummaries, ' \n\t')).toEqual(fixtureSummaries);
    const original = [...fixtureSummaries];
    const results = searchDresses(filterDresses(fixtureSummaries, 'ao-dai'), 'ao');
    expect(results).toEqual(fixtureSummaries.filter((dress) => dress.styles.includes('ao-dai')));
    expect(fixtureSummaries).toEqual(original);
    expect(results.every((dress) => fixtureSummaries.includes(dress))).toBe(true);
  });
});

describe('CatalogBrowser (AC2–4, AC6)', () => {
  beforeEach(() => {
    window.history.replaceState({ preserved: true }, '', '/bo-suu-tap?utm=test#collection');
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  test('input updates immediately, results/count/URL wait 300 ms after the LAST keystroke', () => {
    renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    const network = vi.spyOn(globalThis, 'fetch');
    const initial = names();
    type('dam');
    advance(200);
    type('AO DAI');
    expect(input()).toHaveValue('AO DAI');
    advance(299);
    expect(names()).toEqual(initial);
    expect(screen.getByRole('status')).toHaveTextContent(`Tìm thấy ${initial.length} mẫu`);
    expect(new URLSearchParams(window.location.search).has('q')).toBe(false);
    advance(1);
    expect(names()).toEqual(['Áo Dài Cách Tân', 'Áo Dài Lụa Hoạ Tiết']);
    expect(screen.getByRole('status')).toHaveTextContent('Tìm thấy 2 mẫu');
    expect(new URLSearchParams(window.location.search).get('q')).toBe('AO DAI');
    expect(new URLSearchParams(window.location.search).get('utm')).toBe('test');
    expect(window.location.hash).toBe('#collection');
    expect(window.history.state).toEqual({ preserved: true });
    expect(network).not.toHaveBeenCalled();
  });

  test('style applies a pending query immediately; clear preserves style; reset restores all', () => {
    renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    type('mini');
    fireEvent.click(screen.getByRole('button', { name: 'Váy ngắn' }));
    expect(names()).toEqual(['Váy Nơ Lưng Mini']);
    advance(400);
    expect(names()).toEqual(['Váy Nơ Lưng Mini']);
    type('no match');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa từ khóa' }));
    expect(input()).toHaveFocus();
    expect(input()).toHaveValue('');
    expect(names()).toEqual(['Váy Sinh Nhật / Prom', 'Váy Nơ Lưng Mini']);
    advance(400);
    expect(names()).toHaveLength(2);
    expect(new URLSearchParams(window.location.search).get('style')).toBe('short');
    expect(new URLSearchParams(window.location.search).has('q')).toBe(false);
    type('old pending');
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ bộ lọc' }));
    advance(400);
    expect(names()).toHaveLength(fixtureSummaries.length);
    expect(window.location.search).toBe('?utm=test');
  });

  test('Enter applies immediately and cancels the pending timer', () => {
    renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    type('ao dai');
    fireEvent.submit(screen.getByRole('search'));
    expect(names()).toHaveLength(2);
    const replace = vi.spyOn(window.history, 'replaceState');
    advance(400);
    expect(replace).not.toHaveBeenCalled();
  });

  test('deep link restores query and style, including after a fresh mount', () => {
    window.history.replaceState(null, '', '/bo-suu-tap?q=lua&style=ao-dai');
    const { unmount } = renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    expect(input()).toHaveValue('lua');
    expect(screen.getByRole('button', { name: 'Áo dài' })).toHaveAttribute('aria-pressed', 'true');
    expect(names()).toEqual(['Áo Dài Lụa Hoạ Tiết']);
    unmount();
    renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    expect(names()).toEqual(['Áo Dài Lụa Hoạ Tiết']);
  });

  test('navigation restores both values and cancels pending search; an unknown style defaults to all', () => {
    renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    type('this must never apply');
    act(() => {
      window.history.replaceState(null, '', '/bo-suu-tap?q=ao+dai&style=unknown');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(input()).toHaveValue('ao dai');
    expect(screen.getByRole('button', { name: 'Tất Cả Thiết Kế' })).toHaveAttribute('aria-pressed', 'true');
    advance(400);
    expect(names()).toHaveLength(2);
    expect(new URLSearchParams(window.location.search).get('q')).toBe('ao dai');
  });

  test('no-match and empty catalogue have distinct messages and a live count', () => {
    const { unmount } = renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    type('no match');
    advance(300);
    expect(screen.getByRole('status')).toHaveTextContent('Tìm thấy 0 mẫu');
    expect(screen.getByText('Không tìm thấy mẫu phù hợp. Thử từ khóa khác nhé.')).toBeInTheDocument();
    expect(names()).toEqual([]);
    unmount();
    renderWithProviders(<CatalogBrowser dresses={[]} />);
    expect(screen.getByText('Bộ sưu tập đang được cập nhật. Nhắn Zalo để được gợi ý nhé.')).toBeInTheDocument();
    expect(screen.queryByText('Không tìm thấy mẫu phù hợp. Thử từ khóa khác nhé.')).not.toBeInTheDocument();
  });

  test('unmount cancels the timer without a late URL update', () => {
    const { unmount } = renderWithProviders(<CatalogBrowser dresses={fixtureSummaries} />);
    type('ao dai');
    const replace = vi.spyOn(window.history, 'replaceState');
    unmount();
    advance(400);
    expect(replace).not.toHaveBeenCalled();
  });
});
