import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import { makeDress, resetCatalog, seedDresses } from '@/test/msw/handlers/catalog';
import {
  getLastCreateRentalBody,
  resetRentals,
  seedBlockedDresses,
} from '@/test/msw/handlers/rentals';
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

test('a 409 (dress unavailable) shows the conflict message and stays on the form', async () => {
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
