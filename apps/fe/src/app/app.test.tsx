import { screen } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';

import { clearTokens, setTokens } from '@/api/mutator/auth-tokens';
import { SessionProvider } from '@/features/auth';
import { testTokenPair } from '@/test/msw/handlers/identity';
import { renderWithProviders } from '@/test/render';

import { RootLayout } from './layouts/root-layout';

beforeEach(() => {
  clearTokens();
});

test('renders the app shell: brand, nav links, language switcher', async () => {
  renderWithProviders(
    <SessionProvider>
      <RootLayout />
    </SessionProvider>,
  );

  expect(await screen.findByText('Quản lý váy')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Hôm nay' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Váy' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Thuê' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toBeInTheDocument();
  // anonymous session → no sign-out affordance
  expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
});

test('shows the sign-out button once the session is authenticated', async () => {
  // Seed a valid refresh token: SessionProvider boot silently refreshes + /me.
  setTokens(testTokenPair);
  renderWithProviders(
    <SessionProvider>
      <RootLayout />
    </SessionProvider>,
  );

  expect(
    await screen.findByRole('button', { name: 'Đăng xuất' }),
  ).toBeInTheDocument();
});
