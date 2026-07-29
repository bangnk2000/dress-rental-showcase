# packages/contract

`openapi.json` is **generated** by `pnpm openapi:emit` (from `apps/be` source) and consumed by
`pnpm generate:api` (Orval, into `apps/fe/src/api/generated/`). It is committed so the repo
builds from a clean checkout, and it is **never hand-edited** — CI regenerates it and fails on
any diff. Full rules: `docs/spec/init-monorepo-contract/02-contract-pipeline.md`.

The file does not exist yet: it appears with the first `pnpm openapi:emit` after `apps/be` is
bootstrapped (README step 2).
