import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import { makeDress, resetCatalog, seedDresses } from '@/test/msw/handlers/catalog';
import { makeBookedRange, resetRentals, seedBookedRanges } from '@/test/msw/handlers/rentals';
import { renderWithProviders } from '@/test/render';

import { DressDetailRoute } from './dress-detail-route';
import { DressListRoute } from './dress-list-route';

function LocationSearchProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

/**
 * The route components render directly (not through the guarded app router):
 * auth is the auth feature's concern, and a local Suspense stands in for the
 * app RouteBoundary.
 */
function renderList(route = '/dresses') {
  return renderWithProviders(
    <>
      <Suspense fallback={<output>loading</output>}>
        <DressListRoute />
      </Suspense>
      <LocationSearchProbe />
      <Toaster />
    </>,
    { route },
  );
}

beforeEach(() => {
  resetCatalog();
  resetRentals();
});

function renderDetail(route: string) {
  return renderWithProviders(
    <Suspense fallback={<output>loading</output>}>
      <Routes>
        <Route path="/dresses/:id" element={<DressDetailRoute />} />
      </Routes>
    </Suspense>,
    { route },
  );
}

test('renders dress rows from the API through Suspense', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm dạ hội đỏ', sizeLabel: 'M' }),
    makeDress({ id: 'd2', code: 'DR-002', name: 'Đầm cưới trắng', status: 'retired' }),
  ]);
  renderList();

  expect(await screen.findByText('DR-001')).toBeInTheDocument();
  expect(screen.getByText('Đầm dạ hội đỏ')).toBeInTheDocument();
  expect(screen.getByText('M')).toBeInTheDocument();
  expect(screen.getByText('DR-002')).toBeInTheDocument();
  // status badges use translated labels
  expect(screen.getByText('Đang cho thuê')).toBeInTheDocument();
  expect(screen.getByText('Ngừng khai thác')).toBeInTheDocument();
  // rows link to the detail page
  expect(screen.getByRole('link', { name: 'DR-001' })).toHaveAttribute(
    'href',
    '/dresses/d1',
  );
});

test('shows the no-dresses empty state when the catalog is empty', async () => {
  renderList();

  expect(await screen.findByText('Chưa có váy nào')).toBeInTheDocument();
  expect(screen.getByText('Thêm váy đầu tiên vào danh mục của tiệm.')).toBeInTheDocument();
});

test('shows the no-match empty state when filters exclude everything', async () => {
  seedDresses([makeDress({ code: 'DR-001', name: 'Đầm đỏ' })]);
  renderList('/dresses?q=khongtontai');

  expect(await screen.findByText('Không tìm thấy váy phù hợp')).toBeInTheDocument();
});

test('search submit updates the URL params and refetches a filtered list', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' }),
    makeDress({ id: 'd2', code: 'DR-002', name: 'Đầm xanh' }),
  ]);
  const user = userEvent.setup();
  renderList();
  expect(await screen.findByText('DR-001')).toBeInTheDocument();

  await user.type(screen.getByRole('searchbox'), 'xanh{Enter}');

  await waitFor(() =>
    expect(screen.getByTestId('location-search')).toHaveTextContent('q=xanh'),
  );
  expect(await screen.findByText('DR-002')).toBeInTheDocument();
  expect(screen.queryByText('DR-001')).not.toBeInTheDocument();
});

test('status filter from the URL narrows the list', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', status: 'active' }),
    makeDress({ id: 'd2', code: 'DR-002', status: 'retired' }),
  ]);
  renderList('/dresses?status=retired');

  expect(await screen.findByText('DR-002')).toBeInTheDocument();
  expect(screen.queryByText('DR-001')).not.toBeInTheDocument();
});

test('create dialog surfaces schema validation messages as translated text', async () => {
  // Seed one dress so the empty state (with its second create button) is absent.
  seedDresses([makeDress({ code: 'DR-001' })]);
  const user = userEvent.setup();
  renderList();
  await screen.findByText('DR-001');

  await user.click(screen.getByRole('button', { name: 'Thêm váy' }));
  await user.click(await screen.findByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Vui lòng nhập mã váy')).toBeInTheDocument();
  expect(screen.getByText('Vui lòng nhập tên váy')).toBeInTheDocument();
  expect(screen.getByText('Vui lòng nhập giá thuê')).toBeInTheDocument();
  expect(screen.getByText('Vui lòng nhập tiền cọc')).toBeInTheDocument();
});

test('creating a dress toasts, closes the dialog, and the invalidated list shows it', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  const user = userEvent.setup();
  renderList();
  await screen.findByText('DR-001');

  await user.click(screen.getByRole('button', { name: 'Thêm váy' }));
  await user.type(await screen.findByLabelText('Mã váy'), 'DR-100');
  await user.type(screen.getByLabelText('Tên váy'), 'Đầm cưới mới');
  await user.type(screen.getByLabelText('Giá thuê (VND)'), '500000');
  await user.type(screen.getByLabelText('Tiền cọc (VND)'), '1000000');
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Đã thêm váy vào danh mục')).toBeInTheDocument();
  // invalidation refetched the list, which now contains the new dress
  expect(await screen.findByText('DR-100')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('a duplicate code maps the 409 to a field error on code', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  const user = userEvent.setup();
  renderList();
  await screen.findByText('DR-001');

  await user.click(screen.getByRole('button', { name: 'Thêm váy' }));
  await user.type(await screen.findByLabelText('Mã váy'), 'DR-001');
  await user.type(screen.getByLabelText('Tên váy'), 'Đầm trùng mã');
  await user.type(screen.getByLabelText('Giá thuê (VND)'), '500000');
  await user.type(screen.getByLabelText('Tiền cọc (VND)'), '1000000');
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Mã váy đã tồn tại')).toBeInTheDocument();
  // the dialog stays open for correction
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('the detail route shows dress info and shades rented/buffer days on the calendar', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm dạ hội đỏ', sizeLabel: 'M' }),
  ]);
  // Far-future dates keep the default month (first upcoming booking) deterministic.
  seedBookedRanges('d1', [
    makeBookedRange({
      startDate: '2099-08-03',
      endDate: '2099-08-05',
      blockedUntilDate: '2099-08-07',
    }),
  ]);
  const { container } = renderDetail('/dresses/d1');

  expect(await screen.findByText('DR-001 — Đầm dạ hội đỏ')).toBeInTheDocument();
  expect(screen.getByText('M')).toBeInTheDocument();
  expect(screen.getByText('Đang cho thuê')).toBeInTheDocument();
  expect(screen.getByText('Lịch đặt')).toBeInTheDocument();

  const statusOf = (date: string) =>
    container.querySelector(`[data-date="${date}"]`)?.getAttribute('data-status');
  expect(statusOf('2099-08-03')).toBe('rented');
  expect(statusOf('2099-08-05')).toBe('rented');
  expect(statusOf('2099-08-06')).toBe('buffer');
  expect(statusOf('2099-08-07')).toBe('buffer');
  expect(statusOf('2099-08-02')).toBe('free');
  expect(statusOf('2099-08-08')).toBe('free');
});

test('the availability checker reports a free range', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001' })]);
  const user = userEvent.setup();
  renderDetail('/dresses/d1');
  await screen.findByText('Kiểm tra lịch trống');

  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2099-09-10' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2099-09-12' } });
  await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));

  expect(await screen.findByRole('status')).toHaveTextContent(/^Còn trống/);
});

test('the availability checker reports conflicts, buffer included', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001' })]);
  seedBookedRanges('d1', [
    makeBookedRange({
      startDate: '2099-08-03',
      endDate: '2099-08-05',
      blockedUntilDate: '2099-08-07',
    }),
  ]);
  const user = userEvent.setup();
  renderDetail('/dresses/d1');
  await screen.findByText('Kiểm tra lịch trống');

  // 08-06..08-07 misses the rental days but sits inside the cleaning buffer.
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2099-08-06' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2099-08-07' } });
  await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));

  expect(await screen.findByText(/^Đã kín/)).toBeInTheDocument();
  expect(screen.getByText(/^Bận từ/)).toBeInTheDocument();
});

test('the availability checker rejects an inverted range client-side', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001' })]);
  const user = userEvent.setup();
  renderDetail('/dresses/d1');
  await screen.findByText('Kiểm tra lịch trống');

  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2099-09-12' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2099-09-10' } });
  await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/khoảng ngày hợp lệ/);
});
