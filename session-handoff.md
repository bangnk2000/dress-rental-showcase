# Session Handoff

Newest first. On resume read ONLY the first entry. Close: prepend one entry (Done / Proof / Next /
Watch out, ≤ ~8 lines — detail belongs in the ledger evidence or the design doc), then keep at most
5 entries here: move the oldest, verbatim, to the top of
[`docs/harness/session-handoff-archive.md`](docs/harness/session-handoff-archive.md) (history only).

## 2026-10-27 (49) — base dress code on public listings (`catalog:public-base-code` = pass)

- Done: owner ask "hiện thị thêm mã váy gốc" → `codes: string[]` on the public Summary/Detail DTO (distinct bases of active dresses, `DressCode.baseOf`), contract regenerated, web card "Mã VAY1" + detail "Mã váy: VAY1". R6 amended in `docs/design/catalog/public-listing.md` §Amendment 2026-10-27. Ledger 50/50.
- Proof: be jest 290, web vitest green, be e2e 150 on real Postgres (public-catalog 8/8), web build green.
- Next: PR → merge; deploy BE FIRST, then web (the new web reads `dress.codes`; against the old BE it is undefined → card/detail throw on `.length`; the old web just ignores the new field). PR #30 (accessory, needs migrate) is still undeployed too.
- Watch out: a code like `VD_012` counts as a copy of `VD` — `baseOf` strips any trailing `_<digits>`; that is existing FR-CAT-08 behaviour, not new.

## 2026-10-19 (48) — listing style `accessory` (Phụ kiện) (`catalog:listing-style-accessory` = pass)

- Done: seventh style code across DB CHECK (migration 1755700000000), `STYLES`, import keyword, FE vi/en labels, web chip + label, contract. PR #30; Codex C1 (no accessory e2e) fixed with migration up/down + `?style=accessory` tests. Ledger 49/49.
- Proof: be jest 289, web vitest 51, be e2e on real Postgres green.
- Next: merge, deploy (**migrate before BE restart**), then staff tag accessory listings in /website.
- Watch out: Codex MCP is pinned to 0.153.2 and the server now rejects every model for it; reviews ran via `codex exec -s read-only` (0.162.1).

## 2026-10-15 (47) — web-only deploys recorded (docs only)

- Done: PR #27 (`web:open-graph`) deployed 03:57 as `1472e07`; PR #28 (`web:static-images` +
  favicon) Codex-approved, CI flake fixed (`e2e/catalog-navigation.spec.ts` clock race), merged and
  deployed 04:59 as `5d797b1`. Ledger evidence + Current state now say so. Ledger 48/48.
- Proof: live example.com — og:* on every page, `/favicon.ico` 200, site images served as
  Cloudflare variants; execution log in `~/deploy-dress/tencent/RUNBOOK.md` §11.6.
- Next: owner runs Sharing Debugger "Scrape Again" on `/`; the r2 release debt (R1–R11, un-packed
  features) is unchanged and these two web deploys add to it.
- Watch out: a local standalone smoke needs `.next/static` + `public/` copied next to `server.js`
  (webbuild.sh does this) or the page never hydrates and every Playwright test fails.

## 2026-10-15 (46) — static images smaller + Cloudflare-resized (`web:static-images` = pass)

- Done: earlier the same session `web:open-graph` was merged (PR #27) and DEPLOYED (web 1472e07).
  Then owner asked about putting logo/hero/store on R2 → kept in repo; compressed sources
  (640 → 144 KB, store.png → store.jpg) and the loader resizes `/images/*` via
  `NEXT_PUBLIC_STATIC_IMAGE_BASE_URL` (prod only). Plus favicon set in `apps/web/src/app/`
  (live `/favicon.ico` was 404). Ledger 48/48.
- Proof: web vitest 51/51, check/lint/arch green; clean prod build → all `<img>` are
  `example.com/cdn-cgi/image/…` variants, og:image unchanged.
- Next: PR review → merge → `webbuild.sh` (already passes the new env) → check live `/` images.
  Still pending from (45): Sharing Debugger "Scrape Again" on `/`.
- Watch out: a standalone smoke server left running shows as `next-server`, not `node server.js`,
  and its ISR writes into the NEXT build's dir if the path is reused — kill by pid/port before
  rebuilding. Not deployed.

## 2026-10-15 (45) — Threads link preview: Open Graph on every page (`web:open-graph` = pass)

- Done: owner report — example.com shared on Threads had no thumbnail until the Sharing Debugger
  re-scraped. Live HTML had no `og:*` at all (only dress detail had openGraph). New
  `apps/web/src/lib/seo.ts` `pageOpenGraph()` on layout + all four pages; ledger 47/47.
- Proof: web vitest 49/49, check/lint/arch green; production build route table unchanged;
  standalone server fetched as facebookexternalhit serves full og:*/twitter:* in `<head>`.
- Next: deploy web (runbook §11) — prod `SITE_URL` must be `https://example.com`; then Sharing
  Debugger "Scrape Again" on `/` once to drop the cached no-image preview.
- Watch out: `next start` refuses `output: standalone` — smoke via `.next/standalone/apps/web/server.js`
  with `HOSTNAME=localhost`. Dress-detail OG image (Cloudflare 1200 variant) proven by unit test
  only (no BE at build). Not deployed.

