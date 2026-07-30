import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The PWA virtual module only exists inside the Vite build; tests use a stub.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/mocks/pwa-register.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
