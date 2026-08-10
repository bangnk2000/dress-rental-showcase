import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import { makeDress, resetCatalog, seedDresses } from '@/test/msw/handlers/catalog';
import {
  getLastCreateRentalBody,
  makeBookedRange,
  resetRentals,
  seedBlockedDresses,
  seedBookedRanges,
} from '@/test/msw/handlers/rentals';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

import { NewRentalRoute } from './new-rental-route';

/**
 * The route renders directly (auth is the auth feature's concern); /rentals
 * is stubbed so the post-create navigation is observable.
 */
function renderNewRental() {
  return renderWithProviders(
    <>
      <Suspense fallback={<output>loading</output>}>
        <Routes>
          <Route path="/rentals/new" element={<NewRentalRoute />} />
          <Route path="/rentals" element={<output>rentals-list-stub</output>} />
        </Routes>
      </Suspense>
      <Toaster />
    </>,
    { route: '/rentals/new' },
  );
}

async function fillCustomerAndDates(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tên khách'), 'Nguyễn Thị Hoa');
  await user.type(screen.getByLabelText('Số điện thoại'), '0903123456');
  // Native date inputs reject keystroke typing in jsdom — set the value directly.
  fireEvent.change(screen.getByLabelText('Ngày nhận'), { target: { value: '2026-08-01' } });
  fireEvent.change(screen.getByLabelText('Ngày trả'), { target: { value: '2026-08-03' } });
}

async function pickDress(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.type(screen.getByPlaceholderText('Tìm theo mã hoặc tên váy…'), code);
  await user.click(await screen.findByRole('button', { name: 'Thêm' }));
}

beforeEach(() => {
  resetCatalog();
  resetRentals();
});

test('submitting the empty form surfaces translated validation messages', async () => {
  const user = userEvent.setup();
  renderNewRental();

  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(await screen.findByText('Vui lòng nhập tên khách')).toBeInTheDocument();
  expect(screen.getByText('Vui lòng nhập số điện thoại')).toBeInTheDocument();
  expect(screen.getByText('Vui lòng chọn ngày nhận')).toBeInTheDocument();
  expect(screen.getByText('Vui lòng chọn ngày trả')).toBeInTheDocument();
});

test('a return date before the pick-up date is rejected by the schema', async () => {
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  fireEvent.change(screen.getByLabelText('Ngày trả'), { target: { value: '2026-07-31' } });
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(await screen.findByText('Ngày trả phải từ ngày nhận trở đi')).toBeInTheDocument();
});

test('submitting without a dress asks for at least one', async () => {
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(await screen.findByText('Vui lòng chọn ít nhất một váy')).toBeInTheDocument();
});

test('searching adds a dress, and creating toasts then navigates to /rentals', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ', rentalPrice: 500_000 }),
  ]);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  expect(screen.getByText('Tạm tính tiền thuê')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(await screen.findByText('Đã tạo lượt thuê')).toBeInTheDocument();
  expect(await screen.findByText('rentals-list-stub')).toBeInTheDocument();
  // the request carried the form exactly: dates inclusive, no price override
  expect(getLastCreateRentalBody()).toEqual({
    customerName: 'Nguyễn Thị Hoa',
    customerPhone: '0903123456',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    items: [{ dressId: 'd1' }],
  });
});

test('the rejected_dress_unavailable outcome keeps the form and explains the overlap', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  seedBlockedDresses(['d1']);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(
    await screen.findByText(
      'Có váy đã được thuê trong khoảng ngày này (tính cả thời gian giặt ủi). Vui lòng đổi ngày hoặc chọn váy khác.',
    ),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Tạo lượt thuê' })).toBeEnabled(),
  );
  expect(screen.queryByText('rentals-list-stub')).not.toBeInTheDocument();
});

test('correcting the booking clears the rejection instead of leaving it on screen', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  seedBlockedDresses(['d1']);
  const unavailable =
    'Có váy đã được thuê trong khoảng ngày này (tính cả thời gian giặt ủi). Vui lòng đổi ngày hoặc chọn váy khác.';
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));
  expect(await screen.findByText(unavailable)).toBeInTheDocument();

  // The rejection answered for 08-01..08-03. Moving the dates makes it a statement about a
  // booking that no longer exists.
  fireEvent.change(screen.getByLabelText('Ngày trả'), { target: { value: '2026-08-05' } });

  await waitFor(() => expect(screen.queryByText(unavailable)).not.toBeInTheDocument());
});

test('dropping the offending dress clears the rejection it described', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  seedBlockedDresses(['d1']);
  const unavailable =
    'Có váy đã được thuê trong khoảng ngày này (tính cả thời gian giặt ủi). Vui lòng đổi ngày hoặc chọn váy khác.';
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));
  expect(await screen.findByText(unavailable)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Bỏ chọn/ }));

  await waitFor(() => expect(screen.queryByText(unavailable)).not.toBeInTheDocument());
});

test('a rejection that answers an EDITED-AWAY booking never marks the current one', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  // The answer arrives after staff has already moved the dates.
  server.use(
    http.post('/api/v1/rentals', async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return HttpResponse.json(
        { status: 'rejected_dress_unavailable', dressIds: ['d1'] },
        { status: 422 },
      );
    }),
  );
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));
  fireEvent.change(screen.getByLabelText('Ngày trả'), { target: { value: '2026-08-09' } });

  // The submit failed, so staff is told — but the dates on screen were never refused, so nothing
  // claims they were.
  expect(await screen.findByText('Không tạo được lượt thuê. Vui lòng thử lại.')).toBeInTheDocument();
  expect(
    screen.queryByText(
      'Có váy đã được thuê trong khoảng ngày này (tính cả thời gian giặt ủi). Vui lòng đổi ngày hoặc chọn váy khác.',
    ),
  ).not.toBeInTheDocument();
});

test.each([
  ['rejected_dress_retired', 'Có váy đã ngừng khai thác. Vui lòng bỏ váy đó khỏi đơn.'],
  ['rejected_dress_not_found', 'Có váy không còn trong danh mục. Vui lòng chọn lại.'],
])('the %s outcome renders its own designed message', async (status, message) => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  // Each rejection has its OWN code and message — proving they no longer collapse into one
  // "conflict" string the way the pre-ADR-0001 409 did.
  server.use(
    http.post('/api/v1/rentals', () =>
      HttpResponse.json({ status, dressIds: ['d1'] }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(screen.queryByText('rentals-list-stub')).not.toBeInTheDocument();
});

test('a chosen dress is checked against the dates BEFORE submit', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  // A booking that ends before the asked range but whose cleaning buffer still covers it — the
  // case staff cannot see on their own, and the reason the message names blockedUntilDate.
  seedBookedRanges('d1', [
    makeBookedRange({
      startDate: '2026-07-28',
      endDate: '2026-07-31',
      blockedUntilDate: '2026-08-02',
    }),
  ]);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');

  // no submit, no rejection: the answer arrives while the form is still being filled
  expect(await screen.findByText('Vướng lịch')).toBeInTheDocument();
  expect(screen.getByText(/Váy này bận tới hết .*2026/)).toBeInTheDocument();
});

test('an available dress says so, so an empty picker never looks like a failure', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');

  expect(await screen.findByText('Còn trống')).toBeInTheDocument();
});

test('the rejection points at the ONE dress that broke the booking', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' }),
    makeDress({ id: 'd2', code: 'DR-002', name: 'Váy cưới' }),
  ]);
  // Only d2 is refused. Before this, both rows looked identical and staff removed dresses by trial.
  seedBlockedDresses(['d2']);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await pickDress(user, 'DR-002');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  const flagged = await screen.findAllByText(
    'Váy này đã có lịch trong khoảng ngày vừa chọn.',
  );
  expect(flagged).toHaveLength(1);
  // the flag sits in DR-002's row, not DR-001's
  expect(flagged[0]!.closest('li')).toHaveTextContent('DR-002');
});

test('changing the dates drops a rejection that answered for the old range', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  seedBlockedDresses(['d1']);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));
  await screen.findByText('Váy này đã có lịch trong khoảng ngày vừa chọn.');

  fireEvent.change(screen.getByLabelText('Ngày nhận'), { target: { value: '2026-09-01' } });

  await waitFor(() =>
    expect(
      screen.queryByText('Váy này đã có lịch trong khoảng ngày vừa chọn.'),
    ).not.toBeInTheDocument(),
  );
});

test('a fault envelope falls back to the generic toast, not an outcome message', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
  server.use(
    http.post('/api/v1/rentals', () =>
      HttpResponse.json(
        { error: { code: 'GENERIC.INTERNAL', message: 'Internal server error' } },
        { status: 500 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(
    await screen.findByText('Không tạo được lượt thuê. Vui lòng thử lại.'),
  ).toBeInTheDocument();
});
