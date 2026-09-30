# Release Record — 2026-09-30-r2

Unlike r1, this record is not a seed: the rollout already happened. Times are +07 on 2026-09-30,
taken from timestamps the commands printed; `≈` marks a time placed between two printed ones.

| Field | Value |
| --- | --- |
| BE deployed | `a4d32cb` — shipped 16:00:19, built + migrated + restarted ≈16:15 |
| CMS deployed | `a4d32cb` — 16:16 with the web link hidden, rebuilt 16:25 with `VITE_WEB_ORIGIN=https://example.com`; `VITE_IMAGE_BASE_URL=https://img.example.com` both times |
| Web deployed | `a4d32cb` — built in WSL and shipped 16:22 (0 published listings at build), pm2 `dress-web` online right after |
| Migrations applied | `1755500000000_dress_listings`, `1755600000000_listing_styles` — `pgmigrations` count 10 → 12 |
| Data before | 155 dresses, 64 rentals, 88 rental items, 103 payments, 3 staff (restore rehearsal of the 16:00 dump) |
| Data written by the release | 100 draft listings, 142 listing memberships (`be:listings-from-dresses`, 16:34, after a second backup); 0 published |
| Flag states | none — no feature flags (release-plan R2) |
| Go/no-go | **GO** — bangnk, 2026-09-30, by instruction ("hãy triển khai đi", then "chạy thật luôn" for the listings tool). Given before this pack existed (release-plan R9) |
| Known issues | release-plan R1–R11; VAY87 draft named "Chưa có mã"; 10 drafts on the default style `silk` |
| Features released | the ten in [README](./README.md) — entries in [`feature_list.json`](../../../feature_list.json) |

## Timeline

| Time | Event | Verification |
| --- | --- | --- |
| 16:00 | Backup `dress_rental_20260930_090003.dump` | restore rehearsal OK; on R2 `daily/`; WSL copy sha256 = VPS |
| 16:00 | `a4d32cb` shipped (source only; the running API untouched) | `.deployed` |
| 16:04 | Photo token setup attempt 1 → 403 AccessDenied on read AND write | diagnosed on the VPS: signature valid, no permission |
| 16:07 | Attempt 2 → TLS failure: the token VALUE had been typed into the account-id prompt, and pasted into the chat | raw value removed from the VPS secrets file within minutes; owner rolled the token later (P8) |
| 16:13 | Attempt 3 → 403 again; from WSL too (not an IP filter) | then the owner named the real bucket: `dress-rental-prod-media`, not the planned `dress-rental-media` |
| ≈16:14 | `media-setup.sh --reuse` with the right bucket | public read 200, variant 200, CORS 204 / foreign 403, `nosniff` |
| ≈16:15 | `build.sh` — API stopped ~1–2 min, migrate, restart | `migrations=12`, `photo upload: ON`, `unstable_restarts=0` |
| 16:16 | CMS shipped, `serve.sh`, `verify-external.sh` | all staff checks green; anonymous `/api/v1/public/dresses` 200 |
| ≈16:17 | Found: `example.com` answering 525 / 520 — the apex already pointed at this origin, no certificate yet | wave 2 started at once |
| 16:22 | Web build: the ssh tunnel was refused (sshd `AllowTcpForwarding no`; loosening it was declined) → build reads the public API | build OK, `.env` dropped from the bundle, internal checks 200 ×4 / 404 |
| 16:22–16:24 | `tls.sh example.com` | certificate to 2026-12-29, renewal dry-run OK, web vhost with `/api/` closed |
| 16:25 | CMS rebuilt with the web link; `verify-external.sh` | staff + public site all green: pages 200, unknown 404, `/api/` on the public name 404, http → 301, sitemap on `https://example.com`, origin by IP unreachable |
| ≈16:28 | Listings tool dry-run on production | would create 100, 10 default `silk` |
| ≈16:33 | Leaked token check | leaked value → 401; stored secret ≠ its hash |
| 16:34 | Backup `dress_rental_20260930_093358.dump`, then the real run | created=100 failed=0; dry-run again → create 0, skipped 100 |

## Deviations from the plan

- Pack written after the rollout (R9).
- Bucket name: the plan said `dress-rental-media`; production is `dress-rental-prod-media`.
- Build-time data source: the plan used an ssh tunnel; production sshd forbids forwarding, so the web
  build reads the public API (R7).
- The apex DNS switch happened before wave 2, not between `webbuild.sh` and `tls.sh`: the public name was
  unreachable (525) for a few minutes.
- A credential was exposed in the chat and rotated (P8).

## Close-out

- [x] Release id appended to each released feature's `evidence` in `feature_list.json`.
- [ ] bangnk writes an accepted-risk note (or a fix) for each of R1–R11 in [release-plan.md](./release-plan.md) §0.
- [ ] Staff review the 100 drafts in `/website` (names, styles, photos) before publishing — R11.
- [ ] The 13 "release debt" features in the [README](./README.md) get readiness files in a later pack, or an explicit decision not to.
