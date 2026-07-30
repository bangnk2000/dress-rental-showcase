import { screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import {
  getLastRentalListParams,
  makeRentalListItem,
  resetRentals,
  seedRentalList,
} from '@/test/msw/handlers/rentals';
import { renderWithProviders } from '@/test/render';

import { RentalsRoute } from './rentals-route';

function renderList(route = '/rentals') {
  return renderWithProviders(
    <Suspense fallback={<output>loading</output>}>
      <Routes>
        <Route path="/rentals" element={<RentalsRoute />} />
        <Route path="/dresses/:id" element={<output>dress-detail-stub</output>} />
        <Route path="/rentals/new" element={<output>new-rental-stub</output>} />
      </Routes>
    </Suspense>,
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
      dresses: [{ dressId: 'd2', code: 'VD-900', name: 'Đầm dạ hội đỏ' }],
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

test('a status filter from the URL narrows the request', async () => {
  // The Radix Select popover does not open under jsdom — drive the filter via
  // the URL, the same trick the dresses list test uses.
  seedRentalList([makeRentalListItem({ status: 'out' })]);
  renderList('/rentals?status=out');

  await screen.findByText('Nguyễn Thị Hoa');
  await waitFor(() => expect(getLastRentalListParams()).toEqual({ status: 'out' }));
});
