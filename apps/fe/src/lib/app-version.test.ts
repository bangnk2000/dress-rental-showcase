import { afterEach, describe, expect, it, vi } from 'vitest';

import { appVersionLabel } from './app-version';

describe('appVersionLabel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('says dev when the build was not made by the deploy workflow', () => {
    vi.stubEnv('VITE_APP_VERSION', '');
    vi.stubEnv('VITE_APP_SHA', '');
    expect(appVersionLabel()).toBe('dev');
  });

  it('names the version and the short commit of a deployed build', () => {
    vi.stubEnv('VITE_APP_VERSION', 'v1.4.2');
    vi.stubEnv('VITE_APP_SHA', 'd2fbfb044131dbfdc04849fc1cd0f9b8a2e7cb32');
    expect(appVersionLabel()).toBe('v1.4.2 · d2fbfb0');
  });

  it('shows an unversioned partial deploy as it was built (v1.0.0+sha7)', () => {
    vi.stubEnv('VITE_APP_VERSION', 'v1.0.0+d2fbfb0');
    vi.stubEnv('VITE_APP_SHA', '');
    expect(appVersionLabel()).toBe('v1.0.0+d2fbfb0');
  });
});
