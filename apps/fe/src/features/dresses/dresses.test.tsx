import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

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
    <>
      <Suspense fallback={<output>loading</output>}>
        <Routes>
          <Route path="/dresses/:id" element={<DressDetailRoute />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>,
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

test('a dress with a photo shows it in the list; one without falls back to the placeholder', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', photoUrls: ['https://example.test/a.jpg'] }),
    makeDress({ id: 'd2', code: 'DR-002', photoUrls: [] }),
  ]);
  const { container } = renderList();
  await screen.findByText('DR-001');

  // The photo is decorative (alt=""): the code next to it is what a screen reader reads, so this
  // asserts the DOM rather than an accessible role.
  const images = container.querySelectorAll('img');
  expect(images).toHaveLength(1);
  expect(images[0]).toHaveAttribute('src', 'https://example.test/a.jpg');
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

test('the rejected_dress_code_taken outcome becomes a field error on code', async () => {
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

test('editing from the detail page prefills the dialog and saves changes incl. photos', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  const user = userEvent.setup();
  renderDetail('/dresses/d1');
  await screen.findByText('DR-001 — Đầm đỏ');

  await user.click(screen.getByRole('button', { name: 'Sửa' }));
  const codeInput = await screen.findByLabelText('Mã váy');
  expect(codeInput).toHaveValue('DR-001'); // prefilled from the dress

  const nameInput = screen.getByLabelText('Tên váy');
  await user.clear(nameInput);
  await user.type(nameInput, 'Đầm đỏ mới');
  fireEvent.change(screen.getByLabelText('Ảnh (mỗi dòng một liên kết)'), {
    target: { value: 'https://example.com/a.jpg' },
  });
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Đã cập nhật váy')).toBeInTheDocument();
  // invalidation refetched the detail: new name in the header, photo rendered
  expect(await screen.findByText('DR-001 — Đầm đỏ mới')).toBeInTheDocument();
  expect(await screen.findByRole('img')).toHaveAttribute('src', 'https://example.com/a.jpg');
});

test('an invalid photo link line blocks the save with a translated error', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001' })]);
  const user = userEvent.setup();
  renderDetail('/dresses/d1');
  await screen.findByRole('button', { name: 'Sửa' });

  await user.click(screen.getByRole('button', { name: 'Sửa' }));
  fireEvent.change(await screen.findByLabelText('Ảnh (mỗi dòng một liên kết)'), {
    target: { value: 'khong-phai-link' },
  });
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(
    await screen.findByText('Mỗi dòng phải là một liên kết http(s) hợp lệ'),
  ).toBeInTheDocument();
});

test('editing to a taken code renders the rejected_dress_code_taken field error', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001' }),
    makeDress({ id: 'd2', code: 'DR-002' }),
  ]);
  const user = userEvent.setup();
  renderDetail('/dresses/d1');
  await screen.findByRole('button', { name: 'Sửa' });

  await user.click(screen.getByRole('button', { name: 'Sửa' }));
  const codeInput = await screen.findByLabelText('Mã váy');
  await user.clear(codeInput);
  await user.type(codeInput, 'DR-002');
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Mã váy đã tồn tại')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument(); // stays open for correction
});

test('retiring a dress (confirmed) flips the badge and removes the retire button', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001' })]);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const user = userEvent.setup();
  renderDetail('/dresses/d1');
  await screen.findByRole('button', { name: 'Ngừng khai thác' });

  await user.click(screen.getByRole('button', { name: 'Ngừng khai thác' }));

  expect(await screen.findByText('Đã ngừng khai thác váy')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Ngừng khai thác' })).not.toBeInTheDocument(),
  );
  expect(screen.getByText('Ngừng khai thác')).toBeInTheDocument(); // the status badge
  confirmSpy.mockRestore();
});
