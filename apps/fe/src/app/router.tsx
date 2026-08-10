import type { ComponentType } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';

import { RequireAuth } from '@/features/auth';

import { RootLayout } from './layouts/root-layout';
import { NotFoundRoute } from './routes/not-found-route';
import { RouteBoundary } from './route-boundary';

/** Every route renders inside its own RouteBoundary (Suspense + error boundary). */
function withBoundary(Component: ComponentType) {
  return function BoundedRoute() {
    return (
      <RouteBoundary>
        <Component />
      </RouteBoundary>
    );
  };
}

/** Pathless layout guarding everything except /sign-in. */
function ProtectedRoutes() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        path: 'sign-in',
        lazy: async () => {
          const { SignInRoute } = await import('@/features/auth');
          return { Component: withBoundary(SignInRoute) };
        },
      },
      {
        Component: ProtectedRoutes,
        children: [
          {
            index: true,
            lazy: async () => {
              const { TodayRoute } = await import('@/features/today');
              return { Component: withBoundary(TodayRoute) };
            },
          },
          {
            path: 'dresses',
            lazy: async () => {
              const { DressListRoute } = await import('@/features/dresses');
              return { Component: withBoundary(DressListRoute) };
            },
          },
          {
            path: 'dresses/:id',
            lazy: async () => {
              const { DressDetailRoute } = await import('@/features/dresses');
              return { Component: withBoundary(DressDetailRoute) };
            },
          },
          {
            path: 'rentals',
            lazy: async () => {
              const { RentalsRoute } = await import('@/features/rentals');
              return { Component: withBoundary(RentalsRoute) };
            },
          },
          {
            path: 'rentals/new',
            lazy: async () => {
              const { NewRentalRoute } = await import('@/features/rentals');
              return { Component: withBoundary(NewRentalRoute) };
            },
          },
          {
            path: 'users',
            lazy: async () => {
              const { UsersRoute } = await import('@/features/users');
              return { Component: withBoundary(UsersRoute) };
            },
          },
        ],
      },
      { path: '*', Component: NotFoundRoute },
    ],
  },
]);
