module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // Both projects: tsconfig.json covers src, test/tsconfig.json covers the e2e suite.
    project: ['tsconfig.json', 'test/tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs', 'plopfile.cjs', 'migrations', 'scripts/*.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
