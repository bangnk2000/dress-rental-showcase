import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'dev-dist', 'coverage', 'src/api/generated/**'],
  },

  // Base: JS + TS recommended, React hooks, fast-refresh hygiene
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // shadcn/ui primitives export variants (cva) alongside components, and the
  // router module exports a route object — fast-refresh precision does not
  // apply to either; exempt them.
  {
    files: ['src/components/ui/**/*.{ts,tsx}', 'src/app/router.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Ring rules: app → features → kernel + api; features never import features;
  // nothing imports app; kernel imports only kernel.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['featureName'] },
        { type: 'api', pattern: 'src/api/**' },
        {
          type: 'kernel',
          pattern: 'src/{components,lib,hooks,stores,types}/**',
        },
        { type: 'test', pattern: 'src/test/**' },
      ],
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      // v7 API (policies + object selectors); expresses the same contract as
      // the deprecated v6 `element-types`/`rules` config it replaced.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: {
                to: { element: { types: ['app', 'feature', 'api', 'kernel'] } },
              },
            },
            {
              from: { element: { type: 'feature' } },
              allow: [
                { to: { element: { types: ['kernel', 'api'] } } },
                // a feature may import itself only (same captured featureName)
                {
                  to: {
                    element: {
                      type: 'feature',
                      captured: {
                        featureName: '{{ from.element.captured.featureName }}',
                      },
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'api' } },
              allow: { to: { element: { types: ['api', 'kernel'] } } },
            },
            {
              from: { element: { type: 'kernel' } },
              allow: { to: { element: { type: 'kernel' } } },
            },
            {
              from: { element: { type: 'test' } },
              allow: {
                to: {
                  element: { types: ['app', 'feature', 'api', 'kernel', 'test'] },
                },
              },
            },
          ],
        },
      ],
    },
  },

  // Test files may reach across rings (they wire everything together)
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'boundaries/dependencies': 'off',
    },
  },

  // Import bans: axios only inside src/api/**; features only via their index;
  // nothing imports app/ internals via the alias.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'HTTP lives in src/api (generated hooks + mutator). Components never touch axios.',
            },
          ],
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Deep feature imports are banned — import the feature public surface @/features/<name>.',
            },
            {
              group: ['@/app/*'],
              message: 'Nothing imports app/ — it is the composition root.',
            },
          ],
        },
      ],
    },
  },
);
