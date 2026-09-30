# Release Plan — 2026-09-30-r2 (2026-09-30)

Features: `infra/web-bootstrap`, `web:public-pages`, `catalog/dress-photo-upload`,
`catalog/photo-upload-on-submit`, `infra/e2e-buffer-pin`, `catalog/public-listing`,
`catalog/listing-styles`, `web:public-catalog-live`, `be:listings-from-dresses`,
`infra/web-standalone` (entries in [`feature_list.json`](../../../feature_list.json)).

From `2ca3e8b` to `a4d32cb`. Executed before this document existed — see [README](./README.md).

## 0. Release-wide readiness

| Check | Status | Evidence |
| --- | --- | --- |
| All harness gates green at the released SHA | ok | PR #22 CI on `c5cb6ad` (merged as `a4d32cb`): contract, web, e2e, scope green; be/fe/qr-admin jobs skipped by path scope — their last green runs are PRs #18–#21, which carry every BE/FE change in this release |
| Contract evidence | ok (type-level) | `pnpm contract:check` in CI across fe, qr-admin AND web clients; no provider/consumer tests (r1 R4 still open) |
| Invariants proven on a real database | ok | `pnpm --filter be test:e2e` 148 tests at `catalog/listing-styles`, incl. the listing CHECKs and the publish-vs-detach race |
| Migrations reversible | partial | both have a `down`; `listing_styles` down is **lossy**, `dress_listings` down **drops** — [rollback.md](./rollback.md) §4 |
| Observability | **missing** | R1 |
| Feature flags | **missing** | R2 |
| Owner + on-call | ok, single person | bangnk (R3) |

### Release-wide unchecked items — each needs bangnk's accepted-risk note

| # | Item | Owner | Accepted-risk note |
| --- | --- | --- | --- |
| R1 | Still no observability. New blind spots: R2 upload failures (they happen in the staff browser, the BE never sees them), 429s on the public API, web ISR regeneration errors (Next keeps serving the last good page silently) | bangnk | _open_ |
| R2 | No feature flags. The public site's only off-switch is DNS / the nginx vhost; photo upload's only off-switch is removing `R2_*` from `apps/be/.env` (→ 503) | bangnk | _open_ |
| R3 | One person is owner, deployer and on-call — now for three surfaces instead of one | bangnk | _open_ |
| R4 | Type-level contract only; the web is a THIRD consumer of the contract | bangnk | _open_ |
| R5 | First anonymous API: `/api/v1/public/*`, throttled 60/min per IP **in memory** (one process — a restart resets counters). On `example.com` nginx closes `/api/` because the Next rewrite would reach the BE from loopback (throttle-exempt). The staff origin still serves `/api/v1/public/*` publicly | bangnk | _open_ |
| R6 | Staff browsers write straight into `dress-rental-prod-media` with signed PUTs. The token behind the signer is Object Read & Write on that bucket with **no IP filter** (by necessity). A removed photo never deletes its object (spec R5): orphans accumulate, unbounded | bangnk | _open_ |
| R7 | `webbuild.sh` reads the catalogue through the PUBLIC API (sshd forbids tunnels): list + one detail per listing counts against 60/min/IP → with > ~50 published listings a rebuild can hit 429, and a 429 **fails the build** (HTTP errors throw — `public-catalog.ts`); the running site is unaffected because the old bundle is only swapped after a successful build | bangnk | _open_ — workaround in the runbook §9 |
| R8 | Public pages are ISR 300 s: publish/hide/price changes reach the web within 5 min, never instantly; no `revalidateTag` hook exists | bangnk | _open_ — owner accepted the 5 min when approving the spec |
| R9 | This pack was written after the rollout. No readiness check could stop anything; the compatibility matrix below was analysed after the mixed states already existed | bangnk | _open_ — this is the lane being skipped, not a technicality |
| R10 | The deploy scripts restart `dress-api` on every `serve.sh` (and `tls.sh` runs serve twice): each is a few seconds of 502 for staff | bangnk | _open_ |
| R11 | `be:listings-from-dresses` ran on production and created 100 draft listings; 10 carry the default style `silk`, one is literally named "Chưa có mã" (VAY87). Nothing is published, so no customer sees them | bangnk | _open_ — staff review in `/website` before publishing |

## 1. Prerequisites — how each one was met

| # | Prerequisite | Why it matters | Status |
| --- | --- | --- | --- |
| P1 | Proven backup before migrating | Both migration `down`s destroy listing data | **met** — 16:00 dump, restore rehearsal OK, R2 + WSL copy, sha256 equal ([record](./record.md)); again 16:34 before the listings tool |
| P2 | Photo bucket + custom domain + Transformations + CORS | Without CORS every staff upload fails in the browser; without Transformations every photo is the full original | **met** — `media-setup.sh` probe: public read 200, `/cdn-cgi/image/` 200, preflight from the CMS origin 204 with allow-origin, foreign origin 403, `nosniff` set |
| P3 | R2 token in the BE environment, separate from the backup token | The secrets file already had `R2_*` for BACKUPS; the BE reads the same names | **met** — stored as `MEDIA_R2_*`, mapped to `R2_*` only inside `apps/be/.env`; `verify-external.sh`: `photo upload: ON` |
| P4 | Web process manager + bind address | `HOSTNAME=127.0.0.1` breaks every page behind nginx (`infra/web-standalone` W2) | **met** — pm2 `dress-web`, `HOSTNAME=localhost`, bound `127.0.0.1:3001` (loopback only, checked) |
| P5 | Reverse proxy for the public name | Same-origin, `/api/` closed on the public name (R5) | **met** — nginx vhost `dress-web`, `/api/v1/public/dresses` on `example.com` → 404 from outside |
| P6 | TLS for `example.com` behind Cloudflare Full (strict) | Cloudflare → origin fails with 525 otherwise | **met** — Let's Encrypt, expires 2026-12-29, renewal dry-run OK |
| P7 | DNS apex `example.com` → the VPS, proxied | The site previously at the apex is replaced | **met by the owner** — already pointed before wave 2 (the site answered 525 until the certificate existed) |
| P8 | Leaked credential rotated | An account API token value was pasted into the chat during setup | **met** — rolled by the owner; the leaked value now answers 401 at `/tokens/verify`, and the stored secret is not its hash |

## 2. Steps — as executed

The per-command detail and every verification line live in the runbook outside the repo
(machine-specific: host, key paths). Order and verification:

| # | Step | Command / action | Owner | Verification observed |
| --- | --- | --- | --- | --- |
| 1 | Backup | `backup-now.sh` | bangnk (via agent) | restore rehearsal OK: 155 dresses, 64 rentals, 103 payments |
| 2 | Ship `a4d32cb` | `sync.sh` | same | `.deployed` sha `a4d32cb` |
| 3 | Photo token + bucket probe | `media-setup.sh` (then `--reuse`) | owner typed the secret | 4 probes green (P2) — after 3 failed attempts, see record |
| 4 | BE build + migrate + restart | `build.sh` | agent | migrations 10 → 12; `photo upload: ON`; API ~1–2 min down |
| 5 | CMS build with the web link hidden | `WEB_ORIGIN= febuild.sh` | agent | bundle contains `img.example.com`, not `img-dev` |
| 6 | nginx + pm2 refresh | `serve.sh` + `verify-external.sh` | agent | all staff checks green, anonymous public API 200 |
| 7 | Web build + ship + pm2 `dress-web` | `webbuild.sh` | agent | internal 200/200/200/200/404, loopback bind |
| 8 | Certificate + web vhost | `tls.sh example.com` | agent | cert issued, renew dry-run OK, internal web checks green |
| 9 | CMS rebuild with the web link | `febuild.sh` | agent | `https://example.com` in the bundle |
| 10 | External verification | `verify-external.sh` | agent | every staff + web check green (record) |
| 11 | Listings data | `listings-from-dresses.js --dry-run`, backup, real run, dry-run again | agent on owner's "chạy thật luôn" | created=100 failed=0; re-run would create 0 |

Watch list (manual — R1): staff report of a failed photo Save; `pm2 logs dress-api --err`;
`pm2 logs dress-web`; the web showing a listing ≤ 5 min after publish; `verify-external.sh` daily for
the first week; certificate renewal of BOTH names in December.

## 3. Compatibility matrix

Analysis, written after the fact from the diff `2ca3e8b..a4d32cb`.

| Combination | What breaks | What degrades | Evidence |
| --- | --- | --- | --- |
| New BE + old CMS (PWA cached `2ca3e8b` between steps 4 and 5) | nothing | old CMS has no photo upload, no `/website`; it ignores `DressResponseDto.listings` | the old CMS never called `/photos/upload-urls` or `/listings` (both introduced after `2ca3e8b`); response additions are ignored by the generated client |
| New CMS + old BE (must never exist: rollback swaps the CMS first) | dress detail crashes (`dress.listings.length` on a response without `listings`); `/website` and photo Save fail (404 on `/listings`, `/photos/upload-urls`) | — | [rollback.md](./rollback.md) step 3 runs `DEPLOY_REF=2ca3e8b febuild.sh` BEFORE `sync.sh`/`build.sh`, so the rollout's clean combination (new BE + old CMS) is also the rollback's only mixed state. A staff browser holding the new CMS through the swap is the residual case — reload |
| Web + a BE that errors on `/public/dresses` (e.g. rolled back to `2ca3e8b` → 404, or unmigrated → 500) | a `next build` fails (an HTTP error throws, even at build); new slugs 500 | already-rendered pages keep serving the last good version (a failed ISR revalidation does not replace it) | `apps/web/src/api/public-catalog.ts` `orEmptyAtBuild`: only an UNREACHABLE BE at build becomes an empty catalogue; any HTTP error or any runtime failure throws. Rollback therefore takes the web down first |
| Old photos (external links) + new CMS | nothing | shown unchanged, no variants | `packages/image-url`: only URLs under `IMAGE_PUBLIC_BASE_URL` become variants (`catalog/dress-photo-upload` D1) |
