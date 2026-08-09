import type { Config } from 'jest';

/**
 * Invariant-proof suite: runs against a REAL Postgres (see global-setup.ts), because the
 * invariants under test are enforced by the database, not by application code
 * (docs/spec/init-nestjs-hexagonal/09-testing-strategy.md §Invariant proof tests).
 */
const config: Config = {
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: '.*\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // test/tsconfig.json is what pulls in test/types/pg.d.ts (the root one includes src only).
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
  },
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 30_000,
  // One app + one pool at a time: the specs truncate shared tables.
  maxWorkers: 1,
};

export default config;
