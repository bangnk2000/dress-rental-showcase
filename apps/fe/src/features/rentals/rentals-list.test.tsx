import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import { server } from '@/test/msw/server';
import {
  getLastCancelRentalId,
  getLastCollectBody,
  getLastCollectRentalId,
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
        {
          dressId: 'd2',
          code: 'VD-900',
          name: 'Đầm dạ hội đỏ',
          depositAmount: 2_000_000,
          agreedPrice: 1_200_000,
        },
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

  await user.click(await screen.findByRole('button', { name: /^Tiền/ }));

  expect(await screen.findByText('Hoàn cọc')).toBeInTheDocument();
  expect(screen.getByText('Phí trễ hạn')).toBeInTheDocument();
  expect(screen.getByText('Trễ 1 ngày')).toBeInTheDocument();
  // Scoped to the movement list: the same amount now legitimately appears again in the totals
  // block below it. formatVnd reads the APP i18n instance (not the test one), so the separator
  // depends on its detected language — accept vi (.) and en (,) grouping.
  const movements = within(screen.getByRole('list'));
  expect(movements.getByText(/2[.,]800[.,]000/)).toBeInTheDocument();
  expect(movements.getByText(/(^|[^.,\d])200[.,]000/)).toBeInTheDocument();
  // A settled rental takes no more money (FR-PAY-02 R4) — no form, only the record.
  expect(screen.queryByLabelText('Tiền cọc')).not.toBeInTheDocument();
});

test('a returned rental without payments shows the empty message', async () => {
  seedRentalList([makeRentalListItem({ status: 'returned' })]);
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: /^Tiền/ }));

  expect(await screen.findByText('Chưa ghi nhận khoản tiền nào.')).toBeInTheDocument();
});

test('FR-PAY-02: a ledger that fails to load says so instead of reading as an empty one', async () => {
  seedRentalList([makeRentalListItem()]);
  server.use(
    http.get('/api/v1/rentals/:id/payments', () =>
      HttpResponse.json({ error: { code: 'GENERIC.INTERNAL', message: 'boom' } }, { status: 500 }),
    ),
  );
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: /^Tiền/ }));

  // "Chưa ghi nhận khoản tiền nào" here would answer the screen's only question — has this rental
  // taken money? — with a confident and possibly wrong no.
  expect(await screen.findByText(/Không đọc được sổ tiền/)).toBeInTheDocument();
  expect(screen.queryByText('Chưa ghi nhận khoản tiền nào.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  // No form either: recording against an unknown ledger is how a deposit gets entered twice.
  expect(screen.queryByLabelText('Tiền cọc')).not.toBeInTheDocument();
});

test('FR-PAY-02: an open rental offers the collect form, pre-filled from catalog + agreement', async () => {
  seedRentalList([makeRentalListItem()]); // booked, one dress: 3.000.000 deposit / 1.500.000 agreed
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: /^Tiền/ }));

  const deposit = await screen.findByLabelText('Tiền cọc');
  const rentalFee = screen.getByLabelText('Tiền thuê');
  expect(deposit).toHaveValue('3000000');
  expect(rentalFee).toHaveValue('1500000');

  await user.clear(deposit);
  await user.type(deposit, '2500000'); // the shop took less than the standard
  await user.click(screen.getByRole('button', { name: 'Ghi nhận' }));

  await waitFor(() => expect(getLastCollectRentalId()).toBe('rental-1'));
  // The ledger records what was TAKEN, and blank fields are omitted rather than sent as 0.
  expect(getLastCollectBody()).toEqual({ deposit: 2_500_000, rentalFee: 1_500_000 });
  expect(await screen.findByText('Đã ghi nhận tiền.')).toBeInTheDocument();
});

test('FR-PAY-02: a kind already on file is stated, not offered for entry again', async () => {
  seedRentalList([makeRentalListItem({ rentalId: 'rental-5', status: 'out' })]);
  seedRentalPayments('rental-5', [
    makePayment({ id: 'p1', kind: 'deposit', amount: 3_000_000, note: null }),
  ]);
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: /^Tiền/ }));

  expect(await screen.findByText(/Tiền cọc: đã ghi nhận/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Tiền cọc')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Tiền thuê')).toBeInTheDocument();
  // The totals row is the API's arithmetic, not a sum computed in the dialog.
  expect(screen.getByText('Tổng đã thu')).toBeInTheDocument();
});

test('FR-PAY-02: rejected_deposit_already_recorded keeps the dialog and marks the field', async () => {
  seedRentalList([makeRentalListItem()]);
  server.use(
    http.post('/api/v1/rentals/:id/payments/collect', () =>
      HttpResponse.json(
        { status: 'rejected_deposit_already_recorded', recordedAmount: 3_000_000 },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: /^Tiền/ }));
  await user.click(await screen.findByRole('button', { name: 'Ghi nhận' }));

  expect(
    await screen.findByText('Khoản này đã được ghi nhận trước đó — xem danh sách ở trên.'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Tiền thuê')).toBeInTheDocument(); // dialog still open
});

test('FR-PAY-02: rejected_rental_closed closes the dialog and says which status blocked it', async () => {
  seedRentalList([makeRentalListItem()]);
  server.use(
    http.post('/api/v1/rentals/:id/payments/collect', () =>
      HttpResponse.json(
        { status: 'rejected_rental_closed', currentStatus: 'cancelled' },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderList();

  await user.click(await screen.findByRole('button', { name: /^Tiền/ }));
  await user.click(await screen.findByRole('button', { name: 'Ghi nhận' }));

  expect(await screen.findByText(/đang ở trạng thái "Đã huỷ"/)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('a status filter from the URL narrows the request', async () => {
  // The Radix Select popover does not open under jsdom — drive the filter via
  // the URL, the same trick the dresses list test uses.
  seedRentalList([makeRentalListItem({ status: 'out' })]);
  renderList('/rentals?status=out');

  await screen.findByText('Nguyễn Thị Hoa');
  await waitFor(() => expect(getLastRentalListParams()).toEqual({ status: 'out' }));
});
