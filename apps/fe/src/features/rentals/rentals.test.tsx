import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, test } from 'vitest';

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

/** The ONE summary element (rental-form-ux P2/P3): sticky panel on desktop, bottom bar on a phone. */
function summarySection() {
  return screen.getByRole('region', { name: 'Tóm tắt đơn thuê' });
}

/** The amount on the same row as a summary label (`dt` → its `dd`). */
function summaryAmount(label: string): string | null | undefined {
  // Intl groups with a no-break space before ₫; compare with plain spaces.
  return within(summarySection())
    .getByText(label)
    .nextElementSibling?.textContent?.replace(/\s/g, ' ');
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
  // The fixture dates (2026-08-01..) are in the PAST → FR-RENT-10 announces the rental will be
  // born delivered, both under the date field and in the success toast.
  expect(
    screen.getByText('Ngày nhận là hôm nay hoặc đã qua — đơn sẽ ghi là ĐÃ GIAO ngay khi tạo.'),
  ).toBeInTheDocument();
  await pickDress(user, 'DR-001');
  // rental-form-ux: the subtotal moved from under the picker into the summary.
  expect(within(summarySection()).getByText('Tạm tính tiền thuê')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(await screen.findByText('Đã tạo lượt thuê và ghi nhận giao váy.')).toBeInTheDocument();
  expect(await screen.findByText('rentals-list-stub')).toBeInTheDocument();
  // the request carried the form exactly: dates inclusive, no price override, and (FR-RENT-14
  // §6.Q1) the pre-filled rental fee as money collected at booking — deposit untouched (§6.Q2)
  expect(getLastCreateRentalBody()).toEqual({
    customerName: 'Nguyễn Thị Hoa',
    customerPhone: '0903123456',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    items: [{ dressId: 'd1' }],
    collect: { rentalFee: 500_000 },
  });
});

describe('FR-RENT-14: money handed over at booking', () => {
  test('fee pre-filled from the agreement, deposit behind an unticked box, both sent when ticked', async () => {
    seedDresses([
      makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ', rentalPrice: 500_000, depositAmount: 2_000_000 }),
    ]);
    const user = userEvent.setup();
    renderNewRental();

    await fillCustomerAndDates(user);
    await pickDress(user, 'DR-001');
    expect(screen.getByLabelText('Tiền thuê đã thu')).toHaveValue('500000');
    const box = screen.getByLabelText('Khách đã đóng cọc');
    expect(box).not.toBeChecked();
    expect(screen.queryByLabelText('Tiền cọc đã thu')).not.toBeInTheDocument();

    await user.click(box);
    const deposit = screen.getByLabelText('Tiền cọc đã thu');
    expect(deposit).toHaveValue('2000000');
    await user.clear(deposit);
    await user.type(deposit, '1500000'); // partial deposit: the ledger records what was taken
    await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

    await screen.findByText('rentals-list-stub');
    expect(getLastCreateRentalBody()).toMatchObject({
      collect: { rentalFee: 500_000, deposit: 1_500_000 },
    });
  });

  test('a cleared fee and no deposit send no collect at all', async () => {
    seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ', rentalPrice: 500_000 })]);
    const user = userEvent.setup();
    renderNewRental();

    await fillCustomerAndDates(user);
    await pickDress(user, 'DR-001');
    await user.clear(screen.getByLabelText('Tiền thuê đã thu'));
    await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

    await screen.findByText('rentals-list-stub');
    expect(getLastCreateRentalBody()).not.toHaveProperty('collect');
  });

  test('Codex C1: a mistyped fee or a ticked-but-empty deposit cannot submit as "not collected"', async () => {
    seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ', rentalPrice: 500_000 })]);
    const user = userEvent.setup();
    renderNewRental();

    await fillCustomerAndDates(user);
    await pickDress(user, 'DR-001');
    const fee = screen.getByLabelText('Tiền thuê đã thu');
    await user.clear(fee);
    await user.type(fee, '500.000'); // separators are not an amount
    await user.click(screen.getByLabelText('Khách đã đóng cọc'));
    await user.clear(screen.getByLabelText('Tiền cọc đã thu'));
    await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

    // '500.000' is NOT 500: Number() would read the separator as a decimal point.
    expect(await screen.findByText(/Nhập số tiền bằng chữ số/)).toBeInTheDocument();
    expect(screen.getByText(/phải nhập số cọc đã thu/)).toBeInTheDocument();
    expect(getLastCreateRentalBody()).toBeNull(); // nothing went out

    await user.clear(fee);
    await user.type(fee, '500000');
    await user.type(screen.getByLabelText('Tiền cọc đã thu'), '3000000');
    await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));
    await screen.findByText('rentals-list-stub');
    expect(getLastCreateRentalBody()).toMatchObject({
      collect: { rentalFee: 500_000, deposit: 3_000_000 },
    });
  });

  test('§6.Q5: a rental handed out today without a deposit is warned about, not blocked', async () => {
    seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
    const user = userEvent.setup();
    renderNewRental();

    await fillCustomerAndDates(user); // fixture dates are in the past → born out
    await pickDress(user, 'DR-001');

    expect(screen.getByText(/giao ngay hôm nay nhưng chưa thu cọc/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Khách đã đóng cọc'));
    expect(screen.queryByText(/giao ngay hôm nay nhưng chưa thu cọc/)).not.toBeInTheDocument();
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

test('FR-RENT-11: a discount is read back grouped, shown against the subtotal, and sent with the booking', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ', rentalPrice: 500_000 })]);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.type(screen.getByLabelText('Giảm giá (VND)'), '100000');

  expect(screen.getByText('100.000 ₫')).toBeInTheDocument(); // the digits, read back grouped
  // rental-form-ux: the result of the subtraction is the summary's "Khách trả" (was "Tiền thuê
  // sau giảm" under the picker). 400.000 shows there AND as the read-back of the pre-filled fee
  // (FR-RENT-14).
  const summary = summarySection();
  expect(within(summary).getByText('Khách trả')).toBeInTheDocument();
  expect(within(summary).getByText('400.000 ₫')).toBeInTheDocument();
  expect(screen.getAllByText('400.000 ₫').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByLabelText('Tiền thuê đã thu')).toHaveValue('400000');

  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  await screen.findByText('rentals-list-stub');
  expect(getLastCreateRentalBody()).toMatchObject({ discountAmount: 100_000 });
});

test('FR-RENT-11: a discount above the subtotal is refused before any request goes out', async () => {
  seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ', rentalPrice: 500_000 })]);
  const user = userEvent.setup();
  renderNewRental();

  await fillCustomerAndDates(user);
  await pickDress(user, 'DR-001');
  await user.type(screen.getByLabelText('Giảm giá (VND)'), '600000');
  await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

  expect(
    await screen.findByText('Giảm giá không được vượt quá tạm tính tiền thuê'),
  ).toBeInTheDocument();
  expect(getLastCreateRentalBody()).toBeNull();
  expect(screen.queryByText('rentals-list-stub')).not.toBeInTheDocument();
});

describe('rental-form-ux: sections and the one summary', () => {
  test('the form is four titled sections', async () => {
    renderNewRental();

    for (const title of ['Khách hàng', 'Ngày thuê', 'Váy', 'Thanh toán']) {
      expect(await screen.findByRole('region', { name: title })).toBeInTheDocument();
    }
    // E5: notes are multi-line now, label unchanged.
    expect(screen.getByLabelText('Ghi chú').tagName).toBe('TEXTAREA');
  });

  test('E3: the day count includes both ends and shows only for a sensible range', async () => {
    const user = userEvent.setup();
    renderNewRental();

    await fillCustomerAndDates(user); // 2026-08-01 → 2026-08-03
    expect(screen.getByText('3 ngày')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ngày trả'), { target: { value: '2026-08-01' } });
    expect(screen.getByText('1 ngày')).toBeInTheDocument(); // a single-day rental is 1, not 0

    fireEvent.change(screen.getByLabelText('Ngày trả'), { target: { value: '2026-07-31' } });
    expect(screen.queryByText(/^\d+ ngày$/)).not.toBeInTheDocument();
  });

  test('the summary shows its arithmetic: subtotal − discount = what the customer pays', async () => {
    seedDresses([
      makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ', rentalPrice: 500_000, depositAmount: 2_000_000 }),
      makeDress({ id: 'd2', code: 'DR-002', name: 'Váy cưới', rentalPrice: 300_000, depositAmount: 1_000_000 }),
    ]);
    const user = userEvent.setup();
    renderNewRental();

    await fillCustomerAndDates(user);
    await pickDress(user, 'DR-001');
    await pickDress(user, 'DR-002');
    await user.type(screen.getByLabelText('Giảm giá (VND)'), '100000');

    const summary = within(summarySection());
    // Each picked dress, by code and price.
    expect(summary.getByText('DR-001 · 500.000 ₫')).toBeInTheDocument();
    expect(summary.getByText('DR-002 · 300.000 ₫')).toBeInTheDocument();
    expect(summaryAmount('Tạm tính tiền thuê')).toBe('800.000 ₫');
    expect(summaryAmount('Giảm giá')).toBe('−100.000 ₫');
    expect(summary.getByText('700.000 ₫')).toBeInTheDocument(); // Khách trả
    expect(summary.getByText('(2 váy)')).toBeInTheDocument();

    // The deposit is separate and, until collected, labelled as the catalog REFERENCE.
    expect(summary.getByText('Cọc chuẩn (tham khảo, chưa thu)')).toBeInTheDocument();
    expect(summary.getByText('3.000.000 ₫')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Khách đã đóng cọc'));
    const deposit = screen.getByLabelText('Tiền cọc đã thu');
    await user.clear(deposit);
    await user.type(deposit, '2500000');
    expect(summary.getByText('Tiền cọc đã nhận')).toBeInTheDocument();
    expect(summary.queryByText('Cọc chuẩn (tham khảo, chưa thu)')).not.toBeInTheDocument();
    expect(summary.getByText('2.500.000 ₫')).toBeInTheDocument();
    // …and never folded into what the customer pays.
    expect(summary.getByText('700.000 ₫')).toBeInTheDocument();
  });

  test('ONE submit button, inside the form and the summary; Huỷ sits next to it', async () => {
    renderNewRental();

    const submits = await screen.findAllByRole('button', { name: 'Tạo lượt thuê' });
    expect(submits).toHaveLength(1);
    const submit = submits[0]!;
    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit.closest('form')).not.toBeNull();
    const summary = within(summarySection());
    expect(summary.getByRole('button', { name: 'Tạo lượt thuê' })).toBe(submit);
    expect(summary.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hủy' })).toHaveLength(1);
  });

  test('E2: the breakdown is a disclosure — aria-expanded follows the toggle, which never submits', async () => {
    const user = userEvent.setup();
    renderNewRental();

    const toggle = await screen.findByRole('button', { name: 'Xem chi tiết tính tiền' });
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const controlled = (toggle.getAttribute('aria-controls') ?? '').split(' ');
    expect(controlled.length).toBeGreaterThan(0);
    for (const id of controlled) expect(document.getElementById(id)).not.toBeNull();
    // The breakdown it controls is the one holding the subtotal.
    expect(
      controlled.some((id) => document.getElementById(id)?.textContent?.includes('Tạm tính tiền thuê')),
    ).toBe(true);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Ẩn chi tiết tính tiền');
    // A button inside the <form> that submitted would surface the validation messages.
    expect(screen.queryByText('Vui lòng nhập tên khách')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('a rejection alert renders in the summary, right above the submit', async () => {
    seedDresses([makeDress({ id: 'd1', code: 'DR-001', name: 'Đầm đỏ' })]);
    seedBlockedDresses(['d1']);
    const user = userEvent.setup();
    renderNewRental();

    await fillCustomerAndDates(user);
    await pickDress(user, 'DR-001');
    await user.click(screen.getByRole('button', { name: 'Tạo lượt thuê' }));

    const alert = await within(summarySection()).findByRole('alert');
    expect(alert).toHaveTextContent(/Có váy đã được thuê/);
    expect(screen.getAllByText(/Có váy đã được thuê/)).toHaveLength(1);
  });
});
