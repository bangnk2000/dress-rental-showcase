import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import { testTokenPair, testUser } from '@/test/msw/handlers/identity';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { setTokens } from '@/api/mutator/auth-tokens';

import { UsersRoute } from './users-route';

function renderUsers() {
  return renderWithProviders(
    <>
      <Suspense fallback={<output>loading</output>}>
        <Routes>
          <Route path="/users" element={<UsersRoute />} />
          <Route path="/" element={<output>home-stub</output>} />
        </Routes>
      </Suspense>
      <Toaster />
    </>,
    { route: '/users' },
  );
}

beforeEach(() => {
  // The route reads /auth/me — give the mutator a token so the me handler answers.
  setTokens(testTokenPair);
});

test('owner sees every account with status, and the locked row offers unlock', async () => {
  renderUsers();

  expect(await screen.findByRole('heading', { name: 'Nhân viên' })).toBeInTheDocument();
  expect(screen.getByText('chu-tiem')).toBeInTheDocument();
  expect(screen.getByText('lan')).toBeInTheDocument();
  expect(screen.getByText('bi-khoa')).toBeInTheDocument();
  expect(screen.getAllByText('Đã khoá')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Mở khoá' })).toBeInTheDocument();
  // The owner's own row must NOT offer a lock — the BE would refuse it anyway.
  expect(screen.getAllByRole('button', { name: 'Khoá' })).toHaveLength(1);
});

test('a staff session is redirected off the route entirely', async () => {
  server.use(
    http.get('*/api/v1/auth/me', () =>
      HttpResponse.json({ ...testUser, role: 'staff' as const }),
    ),
  );
  renderUsers();

  expect(await screen.findByText('home-stub')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Nhân viên' })).not.toBeInTheDocument();
});

test('creating a duplicate username puts the rejection on the field, not a toast', async () => {
  const user = userEvent.setup();
  renderUsers();

  await user.click(await screen.findByRole('button', { name: 'Thêm nhân viên' }));
  await user.type(screen.getByLabelText('Tên đăng nhập'), 'LAN'); // normalizes to the taken 'lan'
  await user.type(screen.getByLabelText('Tên hiển thị'), 'Lan Mới');
  await user.type(screen.getByLabelText('Mật khẩu'), 'mat-khau-du-dai');
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

  expect(
    await screen.findByText('Tên đăng nhập này đã có người dùng'),
  ).toBeInTheDocument();
});

test('locking goes through the app confirm dialog and refreshes the list', async () => {
  const user = userEvent.setup();
  let deactivatedId: string | null = null;
  server.use(
    http.post('*/api/v1/users/:id/deactivate', ({ params }) => {
      deactivatedId = String(params.id);
      return HttpResponse.json({ id: params.id });
    }),
  );
  renderUsers();

  await user.click(await screen.findByRole('button', { name: 'Khoá' }));
  // ConfirmDialog names the account it is about to lock; its confirm button repeats the verb.
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText('Khoá tài khoản lan?')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Khoá' }));

  await waitFor(() => expect(deactivatedId).toBe('user-2'));
});
