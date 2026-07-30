import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import {
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
    <Suspense fallback={<output>loading</output>}>
      <Routes>
        <Route path="/" element={<TodayRoute />} />
        <Route path="/dresses/:id" element={<output>dress-detail-stub</output>} />
      </Routes>
    </Suspense>,
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

test('an empty board shows both empty states', async () => {
  renderToday();

  expect(
    await screen.findByText('Không có lượt thuê nào cần giao.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Không có lượt thuê nào cần nhận về.')).toBeInTheDocument();
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
