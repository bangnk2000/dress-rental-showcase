# Rollback — 2026-09-30-r2

Previous production state: `2ca3e8b` (CMS + API only, 10 migrations, no web, no photo upload).
Commands are the out-of-repo runbook's (`~/deploy-dress/tencent/RUNBOOK.md` §11.2 / §11.4).

## Trigger conditions

There is no monitoring (release-plan R1), so the triggers are observations, not dashboards.

| Condition | Threshold | Source |
| --- | --- | --- |
| Staff cannot load `/dresses`, `/rentals` or the board | any, reproducible | staff report; `verify-external.sh` |
| Photo Save fails for staff | 2 staff members, or 1 repeated after a reload | staff report; browser console shows the failed PUT |
| `dress-api` restarts on its own | `unstable_restarts` > 0 or ↺ climbing without a deploy | `status.sh` |
| Public site errors | 5xx on `/`, `/bo-suu-tap` from outside | `verify-external.sh` §public site |
| Memory | `mem available` < 700 MB or any OOM event | `verify-external.sh` |

## Steps (cheapest reversal first)

1. **Public site off** (seconds, no data effect) — Cloudflare: point the apex `example.com` back to its
   previous target, or on the VPS remove the `dress-web` vhost (`rm /etc/nginx/sites-enabled/dress-web
   && nginx -t && systemctl reload nginx`) and `pm2 delete dress-web && pm2 save`. Verify: `example.com`
   no longer served by this origin; the CMS unaffected.
2. **Photo upload off** (one API restart) — delete the `MEDIA_R2_*` lines from `/root/.dress-secrets` and run
   `build.sh`, or blank the `R2_*` lines in `apps/be/.env` and `pm2 restart dress-api --update-env`.
   Verify: `verify-external.sh` → `photo upload: OFF`; Save with a photo answers 503
   `PHOTO.STORAGE_UNAVAILABLE`, everything else works. Already-uploaded photos keep rendering.
3. **CMS, then API, back to `2ca3e8b`, schema kept** (API ~1–2 min down). CMS FIRST: `febuild.sh`
   builds in WSL and only swaps `apps/fe/dist`, so it runs while the new API is still up — and
   new API + old CMS is the clean combination (release-plan §3). The reverse window is NOT clean: the new
   CMS dress detail reads `dress.listings.length`, which an old API response does not carry.
   `git switch --detach 2ca3e8b` → `DEPLOY_REF=2ca3e8b febuild.sh` (verify: staff pages load, no
   `/website` link) → `DEPLOY_REF=2ca3e8b sync.sh` → `build.sh` → `serve.sh` → `verify-external.sh` →
   `git switch master`. Staff with the PWA open reload once after the CMS swap.
   Safe on the migrated DB: both new migrations only ADD tables (`dress_listings`,
   `dress_listing_items`); `2ca3e8b` never reads them; node-pg-migrate on the old code sees 12 applied /
   10 files, the first 10 match, nothing to run. Verify: staff pages green, `.deployed` = `2ca3e8b`.
   Do step 1 first — the web cannot read `/public/dresses` from the old API.
4. **Schema reversal — last resort, destructive.** `pnpm --filter be migrate down` twice, from the
   `a4d32cb` code (the old code does not have the files):
   - `1755600000000_listing_styles` down: renames `styles` → `occasions` and rewrites every row to
     `ao-dai` or `gala`. **Lossy**: all six style codes collapse to two; `short`, `silk`, `sleeved`,
     `off-shoulder`, `strappy-strapless` become `gala` and cannot be recovered by migrating up again.
   - `1755500000000_dress_listings` down: `DROP TABLE dress_listing_items; DROP TABLE dress_listings;`.
     **Destroys** every listing: the 100 drafts from `be:listings-from-dresses`, and any name, tagline,
     description, photo choice, style or publish state staff added in `/website` since.
   Prefer restoring the pre-release dump (`dress_rental_20260930_090003.dump`, 16:00) ONLY if data is
   corrupted — it also discards every rental and payment written after 16:00.

## Undoing the listings tool alone

The tool wrote only drafts (nothing published). To remove them without touching the schema: delete them
in `/website` (owner may delete any listing), or `DELETE FROM dress_listings WHERE first_published_at IS
NULL` (cascades to `dress_listing_items`). Its pre-run backup: `dress_rental_20260930_093358.dump`
(16:34). Re-running the tool afterwards is safe — a dress group already in a listing is skipped.

## Data implications

- Rentals, payments, dresses, staff: untouched by every step above except a dump restore.
- Photos: `dresses.photo_urls` keeps R2 URLs through steps 1–3; the objects stay in
  `dress-rental-prod-media` (nothing ever deletes them — release-plan R6). Under `2ca3e8b` they still
  render (as plain URLs, no variants).
- Listings: survive steps 1–3; lost at step 4 (see above).

## Who decides

bangnk triggers a rollback — nobody else, including any agent.
