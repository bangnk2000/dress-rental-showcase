/** Architecture guardrails — run via `pnpm --filter be arch`. */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-pure',
      comment: 'Domain imports no framework/IO/SDK (03-domain-layer). libs/ddd bases are allowed.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: {
        path: '^node_modules/(@nestjs|slonik|pg|bcryptjs|@nestjs/jwt|pino|express)',
      },
    },
    {
      name: 'no-cross-module',
      comment: 'Modules talk via bus/events only, never direct imports (01-architecture-principles).',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'libs-no-modules',
      comment: 'The shared kernel never imports a bounded context.',
      severity: 'error',
      from: { path: '^src/libs' },
      to: { path: '^src/modules' },
    },
    {
      name: 'commands-no-sql-driver',
      comment: 'Write-side services go through repository ports, never the driver (04-application-layer).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/commands/.+\\.service\\.ts$' },
      to: { path: '^node_modules/(slonik|pg)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.spec\\.ts$' },
  },
};
