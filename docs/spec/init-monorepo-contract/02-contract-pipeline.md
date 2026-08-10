# Contract Pipeline — BE Source → openapi.json → Generated FE Client

## 1. The One-Way Chain

```
apps/be DTOs + decorators           ← humans edit HERE and only here
   │  pnpm openapi:emit             (offline: boot AppModule, dump swagger doc, exit)
   ▼
packages/contract/openapi.json      ← generated, committed, reviewed as part of the PR diff
   │  pnpm generate:api             (Orval, per init-react 04 — input path per 01 §4.1)
   ▼
apps/fe/src/api/generated/          ← generated, committed (init-react 04 rules apply verbatim)
```

Direction is absolute. "The FE needs field X" means: add X to the BE DTO → `pnpm contract` →
the typed hook now has X. (Where the semantics of X were decided: §5 step 0 — the approved
use-case spec.) Hand-editing either generated artifact is the harness's cardinal sin
(04 STACK_INVARIANTS) and is caught by CI within one PR (03 §1).

## 2. The Emit Script — `apps/be/scripts/emit-openapi.ts`

The ONE file this set adds to the backend. It creates the Nest application context, builds the
Swagger document exactly as `main.ts` does, writes it, and exits — **no `.listen()`, no
database, no infra**.

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';

const OUT = resolve(__dirname, '../../../packages/contract/openapi.json');

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('<product> API')
    .setVersion('0') // fixed — bumping it per release just makes noise diffs in the contract
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });
  writeFileSync(OUT, JSON.stringify(document, null, 2) + '\n');
  await app.close();
}

main().then(
  () => process.exit(0),
  (err) => { console.error(err); process.exit(1); },
);
```

```jsonc
// apps/be/package.json
{ "scripts": { "openapi:emit": "ts-node scripts/emit-openapi.ts" } } // or tsx — match the repo's runner
```

Decisions encoded here:

- **`operationIdFactory` pinned explicitly.** It matches Nest's default, but Orval derives
  every hook name from it — pinning makes "renaming a controller method renames FE hooks" a
  visible, deliberate contract rule instead of an implicit one.
- **`setVersion('0')` fixed.** The contract's identity is its git history, not a semver field;
  a per-release version bump would dirty the freshness gate on every release PR.
- **`logger: false` + exit codes.** The script is a build tool; its only outputs are the file
  and the exit code CI reads.

### The offline-boot trap (read this before it bites)

`NestFactory.create` runs every module's construction. If any provider **connects eagerly at
bootstrap** (TypeORM `autoLoadEntities` with a live connection, a queue client, an SMTP ping),
emit breaks in CI where no infra exists. That is a backend defect by this set's rules
(00 rule 2). Fixes, in order of preference:

1. Lazy connections — infra clients connect on first use, not in the constructor (the
   hexagonal set already pushes this way: adapters own connections).
2. An `OPENAPI_EMIT=1` env flag the infrastructure module reads to register no-op stubs for
   its adapters. Controllers/DTOs — all the spec needs — never touch infra at construction.

Never "fix" it by running a database in the contract CI job — that hides the coupling and
slows every PR.

## 3. BE Spec Discipline — what makes the generated client actually typed

The emit script guarantees a spec EXISTS; these rules make it a spec worth generating from.
They belong in `apps/be`'s `AGENTS.md` (04 carries them as STACK_INVARIANTS):

| Rule | Failure mode it prevents |
| --- | --- |
| Enable the `@nestjs/swagger` CLI plugin in `nest-cli.json` (`introspectComments: true`) | Hand-decorating every DTO field, then forgetting one — silent `any` in the contract |
| Every operation declares its response type: `@ApiOkResponse({ type })` / `@ApiCreatedResponse({ type })`, incl. error envelopes where clients branch on them | Orval emits `unknown`; FE type safety silently evaporates on exactly that endpoint |
| `@ApiTags('<module>')` on every controller, tag == bounded-context name | Orval `tags-split` scatters hooks into a `default/` folder; FE feature slices lose their 1:1 API slice mapping |
| operationId = `Controller_method` (pinned in §2); renames are breaking changes, done deliberately | FE hooks silently renamed → mass mechanical diff obscuring the real change |
| Pagination/error envelopes are SHARED generic DTOs (`PageDto<T>` via `@ApiExtraModels`/`getSchemaPath`) | Orval generates N duplicate page models, one per endpoint |
| Business rejections are outcome bodies `{ status: '<code>', ...payload }` declared per-operation (`@ApiResponse({ status: 422, type })`); transport faults use the ONE shared envelope `{ error: { code, message, details?, correlationId } }` (init-nestjs `07-cross-cutting.md`) | FE cannot distinguish outcomes from the wire — every rejection collapses into one generic message |

## 4. FE Side — nothing new

The entire FE data layer is init-react `04-data-layer.md`, unchanged except the Orval `input`
path (01 §4.1). In particular: generated code read-only, one mutator, generated query keys,
invalidation as the default consistency mechanism. If you are tempted to add something to the
FE to "work around" the contract — stop; it's a BE change (§1).

## 5. The Per-Feature Rhythm

For a feature touching the API (the common case — id conventions in 04):

0. **Spec first, when the feature has business outcomes**: the use-case spec is approved and
   its contract check has run ([`../init-feature-spec/`](../init-feature-spec/README.md)).
   BE-first is the *mechanism* of this pipeline; the approved spec stays the *semantic* source —
   "FE needs a field" is still a BE change first, but which fields and outcomes exist was
   decided in the spec, not invented while typing DTOs.
1. **BE slice first** (init-nestjs 10-module-scaffold): DTOs, controller, use-case + tests.
2. `pnpm contract` at root — emit + regenerate. New hooks appear; changed types turn the FE
   red exactly where it must adapt. **Commit the BE change and both artifacts together.**
3. **FE slice** (init-react 10-feature-scaffold) on the now-typed hooks.
4. Gates: `pnpm contract:check` (no residual drift) → each app's own gates → root harness
   evidence (04).

FE-only or BE-only features skip the irrelevant steps; `contract:check` still runs in CI and
proves the contract untouched.

## 6. Smells

- `openapi.json` or `src/api/generated/**` edited by hand — including "just this once to
  unblock the FE". The unblock is `pnpm contract` after a BE fix, and it's faster.
- Emit script drifting from `main.ts` (different global prefix, versioning, or
  `DocumentBuilder` config) — the served `/docs` and the committed contract must describe the
  same API; extract shared swagger config if they diverge twice.
- An endpoint whose response type in FE code is `unknown`/`any` — trace it back to a missing
  `@ApiOkResponse` (§3), don't cast.
- A PR that changes BE DTOs with **no diff** under `packages/contract` — emit wasn't run;
  CI catches it, but locally `pnpm contract` before push is cheaper.
- The contract job needing Docker services — see the offline-boot trap (§2).
