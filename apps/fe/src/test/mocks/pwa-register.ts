/**
 * Test stub for `virtual:pwa-register/react` — the virtual module only exists
 * inside the Vite build. Aliased in vitest.config.ts.
 */
type StateTuple = [boolean, (value: boolean) => void];

export function useRegisterSW(): {
  needRefresh: StateTuple;
  offlineReady: StateTuple;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: () => Promise.resolve(),
  };
}
