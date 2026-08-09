import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import {
  getLastPickupRentalId,
  getLastReturn,
  getLastTodayBoardDate,
  makeTodayRental,
  resetRentals,
  seedLateFeeQuote,
  seedTodayBoard,
} from '@/test/msw/handlers/rentals';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

import { localDateIso, shiftDateIso } from './lib/local-date';
import { TodayRoute } from './today-route';

function renderToday() {
  return renderWithProviders(
    <>
      <Suspense fallback={<output>loading</output>}>
        <Routes>
          <Route path="/" element={<TodayRoute />} />
          <Route path="/dresses/:id" element={<output>dress-detail-stub</output>} />
        </Routes>
      </Suspense>
      <Toaster />
    </>,
    { route: '/' },
  );
}

beforeEach(() => {
  resetRentals();
});

test('renders both lists and asks the API for the DEVICE-local day', async () => {
  seedTodayBoard({
    dueOut: [makeTodayRental()],
    dueBack: [
      makeTodayRental({
        rentalId: 'rental-2',
        customerName: 'Trần Văn B',
        customerPhone: '0912345678',
        status: 'out',
        dresses: [
          { dressId: 'd2', code: 'VD-900', name: 'Đầm dạ hội đỏ', depositAmount: 2_000_000 },
        ],
      }),
    ],
  });
  renderToday();

  expect(await screen.findByText('Nguyễn Thị Hoa')).toBeInTheDocument();
  expect(screen.getByText('Trần Văn B')).toBeInTheDocument();
  expect(screen.getByText('VD-001')).toBeInTheDocument();
  expect(screen.getByText('VD-900')).toBeInTheDocument();
  // the badge distinguishes not-picked-up from with-the-customer
  expect(screen.getByText('Đã đặt')).toBeInTheDocument();
  expect(screen.getByText('Đang thuê')).toBeInTheDocument();
  expect(getLastTodayBoardDate()).toBe(localDateIso());
});

test('an empty board shows all three empty states', async () => {
  renderToday();

  expect(
    await screen.findByText('Không có lượt thuê nào cần giao.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Không có lượt thuê nào cần nhận về.')).toBeInTheDocument();
  expect(screen.getByText('Không có lượt thuê quá hạn.')).toBeInTheDocument();
});

test('changing the board date refetches that day', async () => {
  renderToday();
  await screen.findByText('Không có lượt thuê nào cần giao.');

  fireEvent.change(screen.getByLabelText('Ngày của bảng'), {
    target: { value: '2099-02-01' },
  });

  await waitFor(() => expect(getLastTodayBoardDate()).toBe('2099-02-01'));
});

test('the day arrows step the board and "Hôm nay" comes straight back', async () => {
  const user = userEvent.setup();
  renderToday();
  await screen.findByText('Không có lượt thuê nào cần giao.');
  const today = localDateIso();

  // Getting back to today was otherwise "remember the date, then use the picker".
  await user.click(screen.getByRole('button', { name: 'Ngày sau' }));
  await waitFor(() => expect(getLastTodayBoardDate()).toBe(shiftDateIso(today, 1)));
  expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeEnabled();

  await user.click(screen.getByRole('button', { name: 'Hôm nay' }));

  // Asserting the input, not the last request: today's board is already in the TanStack cache
  // (fetched at mount, staleTime 60s), so coming back costs no round trip — which is the point.
  await waitFor(() => expect(screen.getByLabelText('Ngày của bảng')).toHaveValue(today));
  // already there → nothing to go back to
  expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeDisabled();
});

test('board actions carry the customer in their accessible name', async () => {
  seedTodayBoard({
    dueOut: [makeTodayRental()],
    dueBack: [makeTodayRental({ rentalId: 'rental-2', status: 'out' })],
  });
  renderToday();

  // "Đã giao váy" repeats down the list; the accessible name has to say whose rental it is.
  expect(
    await screen.findByRole('button', { name: 'Đã giao váy cho Nguyễn Thị Hoa' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Nhận về & tất toán cho Nguyễn Thị Hoa' }),
  ).toBeInTheDocument();
});

test('a dress code links to its detail page', async () => {
  seedTodayBoard({ dueOut: [makeTodayRental()], dueBack: [] });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('link', { name: 'VD-001' }));

  expect(await screen.findByText('dress-detail-stub')).toBeInTheDocument();
});

test('the overdue section lists late rentals with the return action', async () => {
  seedTodayBoard({
    overdue: [makeTodayRental({ status: 'out', endDate: '2099-07-30' })],
  });
  renderToday();

  expect(await screen.findByText('Nguyễn Thị Hoa')).toBeInTheDocument();
  expect(screen.getByText('Đang thuê')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Nhận về & tất toán/ })).toBeInTheDocument();
});

test('the pickup button marks a due-out rental as handed out', async () => {
  seedTodayBoard({ dueOut: [makeTodayRental()] });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Đã giao váy/ }));

  expect(await screen.findByText('Đã ghi nhận giao váy cho khách.')).toBeInTheDocument();
  expect(getLastPickupRentalId()).toBe('rental-1');
});

test('the return dialog settles fees + refund and sends only filled amounts', async () => {
  seedTodayBoard({
    dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })],
  });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));
  // on time + one dress with a 3.000.000 standard deposit → the refund arrives pre-filled in full
  const refundField = await screen.findByLabelText('Hoàn cọc (VND)');
  await waitFor(() => expect(refundField).toHaveValue('3000000'));

  await user.type(screen.getByLabelText('Phí trễ hạn (VND)'), '200000');
  await user.clear(refundField);
  await user.type(refundField, '2800000');
  await user.type(screen.getByLabelText('Ghi chú'), 'Trễ 1 ngày');
  await user.click(screen.getByRole('button', { name: 'Xác nhận trả váy' }));

  expect(await screen.findByText('Đã tất toán lượt thuê.')).toBeInTheDocument();
  // damageFee left blank → omitted from the request entirely
  expect(getLastReturn()).toEqual({
    rentalId: 'rental-9',
    body: { lateFee: 200000, depositRefund: 2800000, note: 'Trễ 1 ngày' },
  });
});

test('a rejected_pickup_not_allowed outcome names the current status and refreshes', async () => {
  seedTodayBoard({ dueOut: [makeTodayRental()] });
  // Another device handed this rental out first: the board is stale, and the staff needs to know
  // WHICH state it is in now — not a generic "already processed" (ADR 0001 §4).
  server.use(
    http.post('/api/v1/rentals/:id/pickup', () =>
      HttpResponse.json(
        { status: 'rejected_pickup_not_allowed', currentStatus: 'out' },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Đã giao váy/ }));

  expect(
    await screen.findByText('Không giao được: lượt thuê đang ở trạng thái "Đang thuê".'),
  ).toBeInTheDocument();
});

test('a rejected_rental_not_found outcome on return closes the dialog', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  server.use(
    http.post('/api/v1/rentals/:id/return', () =>
      HttpResponse.json({ status: 'rejected_rental_not_found' }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));
  await user.click(screen.getByRole('button', { name: 'Xác nhận trả váy' }));

  expect(
    await screen.findByText('Lượt thuê này không còn tồn tại. Bảng đã được làm mới.'),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Xác nhận trả váy' })).not.toBeInTheDocument(),
  );
});

test('FR-RENT-09: the dialog states the late fee and pre-fills the suggested amount', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  seedLateFeeQuote('rental-9', { daysLate: 3, dressCount: 2, suggestedLateFee: 1_200_000 });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));

  // Intl puts a non-breaking space before ₫, so match the digits, not the exact spacing.
  expect(
    await screen.findByText(/Trễ 3 ngày · 2 váy → đề xuất 1\.200\.000/),
  ).toBeInTheDocument();
  // staff reads that number to the customer, so it must already be in the field
  await waitFor(() =>
    expect(screen.getByLabelText('Phí trễ hạn (VND)')).toHaveValue('1200000'),
  );
});

test('FR-RENT-09: a staff waiver keeps the dialog open with the field error', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  seedLateFeeQuote('rental-9', { suggestedLateFee: 600_000 });
  server.use(
    http.post('/api/v1/rentals/:id/return', () =>
      HttpResponse.json(
        {
          status: 'forbidden',
          reason: 'late_fee_waiver_requires_owner',
          suggestedLateFee: 600_000,
          submittedLateFee: 100_000,
        },
        { status: 403 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));
  const lateFeeField = await screen.findByLabelText('Phí trễ hạn (VND)');
  await user.clear(lateFeeField);
  await user.type(lateFeeField, '100000');
  await user.click(screen.getByRole('button', { name: 'Xác nhận trả váy' }));

  expect(
    await screen.findByText('Chỉ chủ tiệm được giảm phí trễ so với số đề xuất.'),
  ).toBeInTheDocument();
  // fixable in place: the dialog stays open so the number can be put back
  expect(screen.getByRole('button', { name: 'Xác nhận trả váy' })).toBeInTheDocument();
});

test('FR-RENT-09: a waiver without a reason points at the note field', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  seedLateFeeQuote('rental-9');
  server.use(
    http.post('/api/v1/rentals/:id/return', () =>
      HttpResponse.json(
        {
          status: 'rejected_waiver_note_required',
          suggestedLateFee: 600_000,
          submittedLateFee: 0,
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));
  await user.click(await screen.findByRole('button', { name: 'Xác nhận trả váy' }));

  expect(await screen.findByText('Giảm phí trễ thì phải ghi lý do.')).toBeInTheDocument();
});

test('FR-RENT-09: a slow quote never erases what staff already typed', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  server.use(
    http.get('/api/v1/rentals/:id/late-fee', async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return HttpResponse.json({
        rentalId: 'rental-9',
        dueDate: '2026-08-03',
        referenceDate: '2026-08-04',
        daysLate: 1,
        dressCount: 1,
        dailyRateAmount: 200_000,
        suggestedLateFee: 200_000,
      });
    }),
  );
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: 'Nhận về & tất toán' }));
  // The dialog is usable before the quote lands, so staff starts working: settling is a
  // conversation with a customer, not a wait for a spinner.
  await user.type(screen.getByLabelText('Ghi chú'), 'Váy dính bùn');
  await user.type(screen.getByLabelText('Phí hư hỏng (VND)'), '500000');

  // When the quote arrives it seeds ONLY the untouched late-fee field.
  await waitFor(() =>
    expect(screen.getByLabelText('Phí trễ hạn (VND)')).toHaveValue('200000'),
  );
  expect(screen.getByLabelText('Ghi chú')).toHaveValue('Váy dính bùn');
  expect(screen.getByLabelText('Phí hư hỏng (VND)')).toHaveValue('500000');
});

test('FR-RENT-09: a late fee staff already edited is not overwritten by the quote', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  server.use(
    http.get('/api/v1/rentals/:id/late-fee', async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return HttpResponse.json({
        rentalId: 'rental-9',
        dueDate: '2026-08-03',
        referenceDate: '2026-08-04',
        daysLate: 1,
        dressCount: 1,
        dailyRateAmount: 200_000,
        suggestedLateFee: 200_000,
      });
    }),
  );
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: 'Nhận về & tất toán' }));
  await user.type(screen.getByLabelText('Phí trễ hạn (VND)'), '300000');

  // A deliberate amount survives; the server's suggestion is still on the banner to read from.
  await waitFor(() =>
    expect(screen.getByText(/đề xuất 200\.000/)).toBeInTheDocument(),
  );
  expect(screen.getByLabelText('Phí trễ hạn (VND)')).toHaveValue('300000');
});

test('FR-RENT-09: a failing quote warns but never blocks the settlement', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  server.use(
    http.get('/api/v1/rentals/:id/late-fee', () =>
      HttpResponse.json(
        { error: { code: 'GENERIC.INTERNAL', message: 'Server error' } },
        { status: 500 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));

  expect(
    await screen.findByText('Không tính được phí trễ hạn. Vui lòng nhập tay.'),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Xác nhận trả váy' })).toBeEnabled(),
  );
});

test('the refund is pre-filled with the standard deposit MINUS the suggested late fee', async () => {
  seedTodayBoard({
    dueBack: [
      makeTodayRental({
        rentalId: 'rental-9',
        status: 'out',
        dresses: [
          { dressId: 'd1', code: 'VD-001', name: 'Váy cưới ren trắng', depositAmount: 3_000_000 },
          { dressId: 'd2', code: 'VD-900', name: 'Đầm dạ hội đỏ', depositAmount: 2_000_000 },
        ],
      }),
    ],
  });
  seedLateFeeQuote('rental-9', { daysLate: 3, dressCount: 2, suggestedLateFee: 1_200_000 });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));

  // 5.000.000 standard deposit − 1.200.000 late fee: the number staff would otherwise
  // reconstruct from memory while the customer waits.
  await waitFor(() =>
    expect(screen.getByLabelText('Hoàn cọc (VND)')).toHaveValue('3800000'),
  );
  expect(screen.getByText(/Cọc chuẩn 2 váy: 5\.000\.000/)).toBeInTheDocument();
  expect(screen.getByText(/hoàn lại khách 3\.800\.000/)).toBeInTheDocument();
});

test('the deposit block recomputes while fees are typed and flags a manual refund', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })] });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));
  await waitFor(() =>
    expect(screen.getByLabelText('Hoàn cọc (VND)')).toHaveValue('3000000'),
  );

  await user.type(screen.getByLabelText('Phí hư hỏng (VND)'), '500000');

  // the block follows the fee field without touching what staff typed in the refund
  expect(await screen.findByText(/hoàn lại khách 2\.500\.000/)).toBeInTheDocument();
  expect(screen.getByText(/Bạn đang nhập 3\.000\.000/)).toBeInTheDocument();
  // and each amount field reads its own digits back, grouped
  expect(screen.getByText('500.000 ₫')).toBeInTheDocument();
});

test('a non-numeric amount blocks the settlement with a translated error', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ status: 'out' })] });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: /Nhận về & tất toán/ }));
  await user.type(screen.getByLabelText('Phí trễ hạn (VND)'), '2trieu');
  await user.click(screen.getByRole('button', { name: 'Xác nhận trả váy' }));

  expect(
    await screen.findByText('Số tiền phải là số nguyên không âm'),
  ).toBeInTheDocument();
  expect(getLastReturn().rentalId).toBeNull();
});
