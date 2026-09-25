import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next', 'coverage', 'next-env.d.ts', 'src/api/generated/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  // Rings (docs/spec/init-nextjs/08-ai-agent-first.md §3a) — boundaries v7 `policies` syntax,
  // same as apps/fe and apps/qr-admin. src/proxy.ts is app-ring by role but stays unclassified:
  // v7 element patterns match folders only, and the proxy imports nothing but src/i18n.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['featureName'] },
        { type: 'api', pattern: 'src/api/**' },
        { type: 'kernel', pattern: 'src/{components,lib,hooks,stores,types,i18n}/**' },
        { type: 'test', pattern: 'src/test/**' },
      ],
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        policies: [
          { from: { element: { type: 'app' } }, allow: { to: { element: { types: ['app', 'feature', 'api', 'kernel'] } } } },
          { from: { element: { type: 'feature' } }, allow: [{ to: { element: { types: ['kernel', 'api'] } } }, { to: { element: { type: 'feature', captured: { featureName: '{{ from.element.captured.featureName }}' } } } }] },
          { from: { element: { type: 'api' } }, allow: { to: { element: { types: ['api', 'kernel'] } } } },
          { from: { element: { type: 'kernel' } }, allow: { to: { element: { type: 'kernel' } } } },
          { from: { element: { type: 'test' } }, allow: { to: { element: { types: ['app', 'feature', 'api', 'kernel', 'test'] } } } },
        ],
      }],
    },
  },
  // Test files may reach across rings (they wire everything together) — same as apps/fe.
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: { 'boundaries/dependencies': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'axios', message: 'HTTP lives in src/api (custom-fetch.ts).' }],
        patterns: [
          { group: ['@/features/*/*'], message: 'Import a feature only through its public index.' },
          { group: ['@/app/*'], message: 'Nothing imports app/; it is the composition root.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'next/link', message: 'Use Link from @/i18n/navigation (keeps the locale).' },
          { name: 'next/navigation', message: 'Use @/i18n/navigation (keeps the locale).' },
        ],
        patterns: [{ group: ['@/features/*/*'], message: 'Import a feature only through its public index.' }],
      }],
    },
  },
);
