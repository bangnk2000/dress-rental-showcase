import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { setTokens } from '@/api/mutator/auth-tokens';
import { Toaster } from '@/components/ui/sonner';
import { testTokenPair, testUser } from '@/test/msw/handlers/identity';
import {
  getLastCancelRentalId,
  getLastUpdateRental,
  makeBookedRange,
  makeRentalDetail,
  resetRentals,
  seedBookedRanges,
  seedRentalDetail,
} from '@/test/msw/handlers/rentals';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

import { EditRentalRoute } from './edit-rental-route';
import { RentalDetailRoute } from './rental-detail-route';

/** Both real routes, so "back to the detail" after an edit is observable; neighbours are stubs. */
function renderRentalRoutes(route: string) {
  return renderWithProviders(
    <>
      <Suspense fallback={<output>loading</output>}>
        <Routes>
          <Route path="/rentals" element={<output>rentals-list-stub</output>} />
          <Route path="/rentals/:id" element={<RentalDetailRoute />} />
          <Route path="/rentals/:id/edit" element={<EditRentalRoute />} />
          <Route path="/dresses/:id" element={<output>dress-detail-stub</output>} />
        </Routes>
      </Suspense>
      <Toaster />
    </>,
    { route },
  );
}

function useStaffSession() {
  server.use(
    http.get('*/api/v1/auth/me', () =>
      HttpResponse.json({ ...testUser, role: 'staff' as const }),
    ),
  );
}

beforeEach(() => {
  resetRentals();
  // Both routes read /auth/me for the owner gate — give the mutator a token so it answers.
  setTokens(testTokenPair);
});

test('FR-RENT-12: the detail shows the agreement in full — notes included — and the owner may edit', async () => {
  seedRentalDetail(
    makeRentalDetail({ notes: 'Khách quen, hẹn 9h sáng', discountAmount: 300_000 }),
  );
  renderRentalRoutes('/rentals/rental-1');

  expect(
    await screen.findByRole('heading', { name: 'Lượt thuê của Nguyễn Thị Hoa' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '0903123456' })).toHaveAttribute(
    'href',
    'tel:0903123456',
  );
  expect(screen.getByText('Khách quen, hẹn 9h sáng')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'VD-001' })).toHaveAttribute('href', '/dresses/d1');
  // Σ agreed 1.500.000 − 300.000 discount, with the arithmetic stated under it.
  expect(screen.getByText(/1[.,]200[.,]000/)).toBeInTheDocument();
  expect(screen.getByText(/Tạm tính 1[.,]500[.,]000 ₫ trừ giảm giá 300[.,]000 ₫/)).toBeInTheDocument();
  expect(screen.getByText('Đã đặt')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sửa đơn' })).toHaveAttribute(
    'href',
    '/rentals/rental-1/edit',
  );
  expect(screen.getByRole('button', { name: 'Huỷ' })).toBeInTheDocument();
});

test('a staff session sees the detail but no edit action', async () => {
  seedRentalDetail(makeRentalDetail());
  useStaffSession();
  renderRentalRoutes('/rentals/rental-1');

  await screen.findByRole('heading', { name: 'Lượt thuê của Nguyễn Thị Hoa' });
  expect(screen.queryByRole('link', { name: 'Sửa đơn' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Tiền/ })).toBeInTheDocument();
});

test('a closed rental offers money only — no edit, no cancel', async () => {
  seedRentalDetail(
    makeRentalDetail({
      status: 'returned',
      dresses: [{ ...makeRentalDetail().dresses[0]!, blocking: false }],
    }),
  );
  renderRentalRoutes('/rentals/rental-1');

  await screen.findByRole('heading', { name: 'Lượt thuê của Nguyễn Thị Hoa' });
  expect(screen.getByText('Đã trả')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Sửa đơn' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Huỷ' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Tiền/ })).toBeInTheDocument();
  expect(screen.getByText('Đã giải phóng lịch')).toBeInTheDocument();
});

test('a cancelled rental shows why it was cancelled (the reason survives a cancel that kept everything)', async () => {
  seedRentalDetail(
    makeRentalDetail({ status: 'cancelled', cancelReason: 'Khách bỏ cọc' }),
  );
  renderRentalRoutes('/rentals/rental-1');

  expect(await screen.findByRole('heading', { name: 'Lý do huỷ' })).toBeInTheDocument();
  expect(screen.getByText('Khách bỏ cọc')).toBeInTheDocument();
});

test('cancelling from the detail confirms in-app, calls the API, and toasts', async () => {
  seedRentalDetail(makeRentalDetail());
  const user = userEvent.setup();
  renderRentalRoutes('/rentals/rental-1');

  await user.click(await screen.findByRole('button', { name: 'Huỷ' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(/Nguyễn Thị Hoa/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Huỷ lượt thuê' }));

  expect(await screen.findByText('Đã huỷ lượt thuê.')).toBeInTheDocument();
  expect(getLastCancelRentalId()).toBe('rental-1');
});

test('FR-RENT-13: the edit form is prefilled from the rental and saves the whole picture, agreed prices included', async () => {
  seedRentalDetail(
    makeRentalDetail({ notes: 'Khách quen, hẹn 9h sáng', discountAmount: 300_000 }),
  );
  const user = userEvent.setup();
  renderRentalRoutes('/rentals/rental-1/edit');

  expect(await screen.findByRole('heading', { name: 'Sửa lượt thuê' })).toBeInTheDocument();
  expect(screen.getByLabelText('Tên khách')).toHaveValue('Nguyễn Thị Hoa');
  expect(screen.getByLabelText('Số điện thoại')).toHaveValue('0903123456');
  expect(screen.getByLabelText('Ngày nhận')).toHaveValue('2099-08-01');
  expect(screen.getByLabelText('Ngày trả')).toHaveValue('2099-08-03');
  expect(screen.getByLabelText('Ghi chú')).toHaveValue('Khách quen, hẹn 9h sáng');
  expect(screen.getByLabelText('Giảm giá (VND)')).toHaveValue('300000');
  // The kept dress shows its AGREED price, not the catalog's; the picker totals follow it.
  expect(screen.getByText('VD-001')).toBeInTheDocument();
  expect(screen.getByText('Tiền thuê sau giảm')).toBeInTheDocument();

  const phone = screen.getByLabelText('Số điện thoại');
  await user.clear(phone);
  await user.type(phone, '0909999999');
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  expect(await screen.findByText('Đã cập nhật lượt thuê.')).toBeInTheDocument();
  expect(getLastUpdateRental()).toEqual({
    rentalId: 'rental-1',
    body: {
      customerName: 'Nguyễn Thị Hoa',
      customerPhone: '0909999999',
      startDate: '2099-08-01',
      endDate: '2099-08-03',
      notes: 'Khách quen, hẹn 9h sáng',
      discountAmount: 300_000,
      items: [{ dressId: 'd1', price: 1_500_000 }],
    },
  });
  // Back on the detail once saved.
  expect(
    await screen.findByRole('heading', { name: 'Lượt thuê của Nguyễn Thị Hoa' }),
  ).toBeInTheDocument();
});

test('FR-RENT-13: blank notes clear (null), no discount is sent as 0', async () => {
  seedRentalDetail(makeRentalDetail({ notes: 'Sẽ xoá' }));
  const user = userEvent.setup();
  renderRentalRoutes('/rentals/rental-1/edit');

  await user.clear(await screen.findByLabelText('Ghi chú'));
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  await waitFor(() => expect(getLastUpdateRental()).not.toBeNull());
  expect(getLastUpdateRental()!.body).toMatchObject({ notes: null, discountAmount: 0 });
});

test('rejected_update_not_allowed names the status and sends the owner back to the detail', async () => {
  seedRentalDetail(makeRentalDetail());
  server.use(
    http.patch('/api/v1/rentals/:id', () =>
      HttpResponse.json(
        { status: 'rejected_update_not_allowed', currentStatus: 'cancelled' },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderRentalRoutes('/rentals/rental-1/edit');

  await user.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));

  expect(await screen.findByText(/Không sửa được.*"Đã huỷ"/)).toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: 'Lượt thuê của Nguyễn Thị Hoa' }),
  ).toBeInTheDocument();
});

test('a dress rejection keeps the edit form and points at the dress, like the create form', async () => {
  seedRentalDetail(makeRentalDetail());
  server.use(
    http.patch('/api/v1/rentals/:id', () =>
      HttpResponse.json(
        { status: 'rejected_dress_unavailable', dressIds: ['d1'] },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderRentalRoutes('/rentals/rental-1/edit');

  await user.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Có váy đã được thuê/);
  expect(screen.getByText('Váy này đã có lịch trong khoảng ngày vừa chọn.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled();
});

test('a staff session is redirected off the edit route to the detail', async () => {
  seedRentalDetail(makeRentalDetail());
  useStaffSession();
  renderRentalRoutes('/rentals/rental-1/edit');

  expect(
    await screen.findByRole('heading', { name: 'Lượt thuê của Nguyễn Thị Hoa' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
});

test('a closed rental shows no form on the edit route', async () => {
  seedRentalDetail(makeRentalDetail({ status: 'cancelled' }));
  renderRentalRoutes('/rentals/rental-1/edit');

  expect(
    await screen.findByText('Lượt thuê đã đóng — không sửa được nữa.'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Tên khách')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Xem lượt thuê' })).toHaveAttribute(
    'href',
    '/rentals/rental-1',
  );
});

test("the picker does not count the rental's OWN booking as a conflict, but another rental's it does", async () => {
  seedRentalDetail(makeRentalDetail());
  // The rental being edited holds d1 for exactly these dates — a self-conflict.
  seedBookedRanges('d1', [makeBookedRange({ rentalId: 'rental-1' })]);
  renderRentalRoutes('/rentals/rental-1/edit');

  expect(await screen.findByText('Còn trống')).toBeInTheDocument();
  expect(screen.queryByText('Vướng lịch')).not.toBeInTheDocument();
});

test('a conflict from another rental still reads as busy on the edit form', async () => {
  seedRentalDetail(makeRentalDetail());
  seedBookedRanges('d1', [
    makeBookedRange({ rentalId: 'rental-1' }),
    makeBookedRange({ rentalId: 'rental-other', startDate: '2099-08-04', endDate: '2099-08-06', blockedUntilDate: '2099-08-08' }),
  ]);
  renderRentalRoutes('/rentals/rental-1/edit');

  expect(await screen.findByText('Vướng lịch')).toBeInTheDocument();
});
