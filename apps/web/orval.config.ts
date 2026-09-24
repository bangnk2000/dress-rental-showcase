import { defineConfig } from 'orval';

// Monorepo delta (docs/spec/init-monorepo-contract/01-workspace-structure.md §4): the contract is
// packages/contract/openapi.json, written by `pnpm openapi:emit` — never a copy in this app.
export default defineConfig({
  api: {
    input: '../../packages/contract/openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      schemas: './src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: {
          path: './src/api/mutator/custom-fetch.ts',
          name: 'customFetch',
        },
        // Functions resolve to the response DTO itself, like apps/fe's hooks — not Orval's default
        // { data, status, headers } wrapper. Non-2xx never resolves: the mutator throws HttpError.
        fetch: {
          includeHttpResponseReturnType: false,
        },
        query: {
          useSuspenseQuery: true,
        },
      },
    },
  },
});
