import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { clearTokens } from '@/api/mutator/auth-tokens';
import { TEST_PASSWORD, testUser } from '@/test/msw/handlers/identity';
import { renderWithProviders } from '@/test/render';

import { RequireAuth, SessionProvider, SignInRoute } from '.';

function renderAuthApp(route: string) {
  return renderWithProviders(
    <SessionProvider>
      <Routes>
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <div>trang chủ</div>
            </RequireAuth>
          }
        />
        <Route
          path="/dresses"
          element={
            <RequireAuth>
              <div>danh sách váy</div>
            </RequireAuth>
          }
        />
      </Routes>
    </SessionProvider>,
    { route },
  );
}

beforeEach(() => {
  // Module access token + localStorage refresh token both reset per test.
  clearTokens();
});

test('anonymous boot: the guard redirects a protected route to /sign-in', async () => {
  renderAuthApp('/dresses');

  expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  expect(screen.queryByText('danh sách váy')).not.toBeInTheDocument();
});

test('successful login lands back on the protected route it was bounced from', async () => {
  const user = userEvent.setup();
  renderAuthApp('/dresses');

  await user.type(await screen.findByLabelText('Email'), testUser.email);
  await user.type(screen.getByLabelText('Mật khẩu'), TEST_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  // Session flipped to authenticated → SignInRoute redirected to state.from.
  expect(await screen.findByText('danh sách váy')).toBeInTheDocument();
});

test('invalid credentials: error message shown, still on the form', async () => {
  const user = userEvent.setup();
  renderAuthApp('/sign-in');

  await user.type(await screen.findByLabelText('Email'), testUser.email);
  await user.type(screen.getByLabelText('Mật khẩu'), 'sai-mat-khau');
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Email hoặc mật khẩu không đúng',
  );
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
});

test('validation errors render resolved from schema i18n keys', async () => {
  const user = userEvent.setup();
  renderAuthApp('/sign-in');

  await user.click(await screen.findByRole('button', { name: 'Đăng nhập' }));

  expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument();
  expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
});
