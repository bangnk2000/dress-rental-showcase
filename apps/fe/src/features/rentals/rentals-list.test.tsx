import { screen, waitFor, within } from '@testing-library/react';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import {
  getLastCancelRentalId,
  getLastRentalListParams,
  makePayment,
  makeRentalListItem,
  resetRentals,
  seedRentalList,
  seedRentalPayments,
} from '@/test/msw/handlers/rentals';
import { renderWithProviders } from '@/test/render';

import { RentalsRoute } from './rentals-route';

function renderList(route = '/rentals') {
  return renderWithProviders(
    <>
      <Suspense fallback={<output>loading</output>}>
        <Routes>
          <Route path="/rentals" element={<RentalsRoute />} />
          <Route path="/dresses/:id" element={<output>dress-detail-stub</output>} />
          <Route path="/rentals/new" element={<output>new-rental-stub</output>} />
        </Routes>
      </Suspense>
      <Toaster />
    </>,
    { route },
  );
}

beforeEach(() => {
  resetRentals();
});

test('renders the rentals page with status badges and dress links', async () => {
  seedRentalList([
    makeRentalListItem(),
    makeRentalListItem({
      rentalId: 'rental-2',
      customerName: 'Trần Văn B',
      status: 'returned',
      dresses: [
        { dressId: 'd2', code: 'VD-900', name: 'Đầm dạ hội đỏ', depositAmount: 2_000_000 },
      ],
    }),
  ]);
  renderList();

  expect(await screen.findByText('Nguyễn Thị Hoa')).toBeInTheDocument();
  expect(screen.getByText('Trần Văn B')).toBeInTheDocument();
  expect(screen.getByText('Đã đặt')).toBeInTheDocument();
  expect(screen.getByText('Đã trả')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'VD-900' })).toBeInTheDocument();
});

test('an empty unfiltered list offers creating the first rental', async () => {
  renderList();

  expect(await screen.findByText('Chưa có lượt thuê nào')).toBeInTheDocument();
  expect(
    screen.getByText('Tạo lượt thuê đầu tiên cho khách của bạn.'),
  ).toBeInTheDocument();
});

test('searching submits q and resets pagination in the URL', async () => {
  seedRentalList([makeRentalListItem()]);
  const user = userEvent.setup();
  renderList('/rentals?page=3');

  await screen.findByText('Nguyễn Thị Hoa');
  await user.type(
    screen.getByLabelText('Tìm theo tên khách hoặc số điện thoại…'),
    'Hoa',
  );
  await user.click(screen.getByRole('button', { name: 'Tìm' }));

  await waitFor(() =>
    expect(getLastRentalListParams()).toEqual({ q: 'Hoa' }),
  );
});

test('pagination requests the next page', async () => {
  seedRentalList([makeRentalListItem()], 45); // 45/20 → 3 pages
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: 'Sau' }));

  await waitFor(() => expect(getLastRentalListParams()).toEqual({ page: '2' }));
});

test('cancelling a booked rental confirms in-app, calls the API, and toasts', async () => {
  seedRentalList([
    makeRentalListItem(),
    makeRentalListItem({ rentalId: 'rental-2', customerName: 'Trần Văn B', status: 'returned' }),
  ]);
  const user = userEvent.setup();
  renderList();

  // only the BOOKED row offers cancel — one button despite two rows
  const cancelButtons = await screen.findAllByRole('button', { name: 'Huỷ' });
  expect(cancelButtons).toHaveLength(1);
  await user.click(cancelButtons[0]!);

  // the app's own dialog, not window.confirm: it names the customer and its confirm button says
  // what it does, so it can never be mistaken for the "Quay lại" next to it
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(/Nguyễn Thị Hoa/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Huỷ lượt thuê' }));

  expect(await screen.findByText('Đã huỷ lượt thuê.')).toBeInTheDocument();
  expect(getLastCancelRentalId()).toBe('rental-1');
});

test('backing out of the confirmation leaves the rental alone', async () => {
  seedRentalList([makeRentalListItem()]);
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: 'Huỷ' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'Quay lại' }));

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(getLastCancelRentalId()).toBeNull();
});

test('the payments dialog lists the settled movements of a returned rental', async () => {
  seedRentalList([
    makeRentalListItem({ rentalId: 'rental-9', customerName: 'Trần Văn B', status: 'returned' }),
  ]);
  seedRentalPayments('rental-9', [
    makePayment({ id: 'p1', kind: 'deposit_refund', amount: 2_800_000, note: 'Trễ 1 ngày' }),
    makePayment({ id: 'p2', kind: 'late_fee', amount: 200_000 }),
  ]);
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: 'Thanh toán' }));

  expect(await screen.findByText('Hoàn cọc')).toBeInTheDocument();
  expect(screen.getByText('Phí trễ hạn')).toBeInTheDocument();
  expect(screen.getByText('Trễ 1 ngày')).toBeInTheDocument();
  // formatVnd reads the APP i18n instance (not the test one), so the separator
  // depends on its detected language — accept vi (.) and en (,) grouping.
  expect(screen.getByText(/2[.,]800[.,]000/)).toBeInTheDocument();
  expect(screen.getByText(/(^|[^.,\d])200[.,]000/)).toBeInTheDocument();
});

test('a returned rental without payments shows the empty message', async () => {
  seedRentalList([makeRentalListItem({ status: 'returned' })]);
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: 'Thanh toán' }));

  expect(
    await screen.findByText('Chưa có khoản thanh toán nào được ghi nhận.'),
  ).toBeInTheDocument();
});

test('a status filter from the URL narrows the request', async () => {
  // The Radix Select popover does not open under jsdom — drive the filter via
  // the URL, the same trick the dresses list test uses.
  seedRentalList([makeRentalListItem({ status: 'out' })]);
  renderList('/rentals?status=out');

  await screen.findByText('Nguyễn Thị Hoa');
  await waitFor(() => expect(getLastRentalListParams()).toEqual({ status: 'out' }));
});
