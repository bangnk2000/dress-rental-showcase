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
      name: 'aws-sdk-only-in-r2-adapter',
      comment:
        'R2 SDK stays behind PhotoUploadSignerPort (docs/design/catalog/dress-photo-upload.md §2 R2).',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: '^src/modules/catalog/database/r2-photo-upload-signer\\.adapter\\.ts$',
      },
      // unanchored: pnpm may resolve through node_modules/.pnpm/<pkg>/node_modules/@aws-sdk/…
      to: { path: 'node_modules/@aws-sdk/' },
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
