import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/api/generated/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['featureName'] },
        { type: 'api', pattern: 'src/api/**' },
        { type: 'kernel', pattern: 'src/{components,lib,hooks,stores,types}/**' },
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
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'axios', message: 'HTTP lives in src/api.' }],
        patterns: [
          { group: ['@/features/*/*'], message: 'Import a feature only through its public index.' },
          { group: ['@/app/*'], message: 'Nothing imports app/; it is the composition root.' },
        ],
      }],
    },
  },
);
