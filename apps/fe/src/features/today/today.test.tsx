import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  seedTodayBoard,
} from '@/test/msw/handlers/rentals';
import { renderWithProviders } from '@/test/render';

import { localDateIso } from './lib/local-date';
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
        dresses: [{ dressId: 'd2', code: 'VD-900', name: 'Đầm dạ hội đỏ' }],
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
  expect(screen.getByRole('button', { name: 'Nhận về & tất toán' })).toBeInTheDocument();
});

test('the pickup button marks a due-out rental as handed out', async () => {
  seedTodayBoard({ dueOut: [makeTodayRental()] });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: 'Đã giao váy' }));

  expect(await screen.findByText('Đã ghi nhận giao váy cho khách.')).toBeInTheDocument();
  expect(getLastPickupRentalId()).toBe('rental-1');
});

test('the return dialog settles fees + refund and sends only filled amounts', async () => {
  seedTodayBoard({
    dueBack: [makeTodayRental({ rentalId: 'rental-9', status: 'out' })],
  });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: 'Nhận về & tất toán' }));
  await user.type(screen.getByLabelText('Phí trễ hạn (VND)'), '200000');
  await user.type(screen.getByLabelText('Hoàn cọc (VND)'), '2800000');
  await user.type(screen.getByLabelText('Ghi chú'), 'Trễ 1 ngày');
  await user.click(screen.getByRole('button', { name: 'Xác nhận trả váy' }));

  expect(await screen.findByText('Đã tất toán lượt thuê.')).toBeInTheDocument();
  // damageFee left blank → omitted from the request entirely
  expect(getLastReturn()).toEqual({
    rentalId: 'rental-9',
    body: { lateFee: 200000, depositRefund: 2800000, note: 'Trễ 1 ngày' },
  });
});

test('a non-numeric amount blocks the settlement with a translated error', async () => {
  seedTodayBoard({ dueBack: [makeTodayRental({ status: 'out' })] });
  const user = userEvent.setup();
  renderToday();

  await user.click(await screen.findByRole('button', { name: 'Nhận về & tất toán' }));
  await user.type(screen.getByLabelText('Phí trễ hạn (VND)'), '2trieu');
  await user.click(screen.getByRole('button', { name: 'Xác nhận trả váy' }));

  expect(
    await screen.findByText('Số tiền phải là số nguyên không âm'),
  ).toBeInTheDocument();
  expect(getLastReturn().rentalId).toBeNull();
});
