import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// MSW server + renderWithProviders (09-testing-strategy.md §3) arrive with the first slice that
// renders server data — there is nothing to intercept yet.
afterEach(() => cleanup());
