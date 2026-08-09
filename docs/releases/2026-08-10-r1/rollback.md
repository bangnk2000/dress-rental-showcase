# Rollback — 2026-08-10-r1

Reversing the FIRST release is a different problem from reversing a later one: there is no previous
version to fall back to. "Rollback" here means **stop serving the app** and, if the schema itself has
to go, accept that reversal is destructive. Read that sentence again before running step 4.

## Trigger conditions (thresholds, not vibes)

No dashboard or alerting exists ([release-plan.md](./release-plan.md) §0), so every source below is a
human reading a log or a screen. That is itself the biggest weakness of this release; the thresholds
are written so they can still be applied by eye.

| Condition | Threshold | Source |
| --- | --- | --- |
| Fault envelopes (`{ error: { … } }`) reaching staff | ANY 500/`INTERNAL` during steps 6–9 | `pm2 logs --err`, pino `"level":50` |
| Staff cannot complete the day's core flow | ONE failed book → hand out → take back cycle that a retry does not fix | step-8 acceptance run / the shop calling bangnk |
| 401 storm (broken refresh) | Staff pushed back to the login screen more than once per person per shift | `pm2 logs` + the shop reporting it |
| `rejected_dress_unavailable` on bookings the shop knows are legal | 2 or more in a day | The staff member disagreeing with the screen |
| Postgres unreachable or migration left half-applied | Any occurrence | `pm2 logs`, `SELECT * FROM pgmigrations` |
| Money written wrong (late fee / deposit refund) | ANY occurrence | The payments dialog vs the cash drawer — real money, zero tolerance |

## Steps (cheapest reversal first)

There is no feature flag to turn off (§0 R2), so the cheapest lever is the web server, not the app.

1. **Take the SPAs offline, leave the API and the data alone.** Point the Nginx vhost at a
   maintenance page and reload. Verify: staff see the notice; `GET /api/v1/dresses` from the VPS
   still answers 401/200. The shop falls back to the Google Sheet for the day, and no data written
   so far is lost.
2. **If the API is the problem: stop it.** `pm2 stop <app>`. Verify: the port is closed; nothing in
   the database changes. Rentals created before this point stay exactly as they were.
3. **If a rebuild is needed: redeploy the previous SHA** — for r1 there is no previous SHA, so this
   step reads "fix forward on a branch, rebuild, re-run steps 1–7". From r2 it becomes
   `git checkout <PREV_SHA> && pnpm install --frozen-lockfile && pnpm --filter be build && …`,
   verified by the step-8 acceptance run.
4. **Schema reversal — `pnpm --filter be migrate:down` — is DESTRUCTIVE. Do not run it once the shop
   has entered real data.** All four migrations reverse by dropping:
   `1753830000001_init` → `DROP TABLE dresses, staff_users`;
   `1753830000002_rentals_payments` → `DROP TABLE payments, rental_items, rentals`;
   `1753830000003_dress_photos` → `DROP COLUMN photo_urls`;
   `1754300000000_qr_links` → `DROP TABLE qr_links`.
   The supported reversal after go-live is **restore from the P5 backup**, and P5 does not exist yet
   — which is why it blocks the release rather than being a nice-to-have.

## Data implications

- Rentals, payments, dresses and QR links written during the window **survive** steps 1–3: those
  steps touch process and web server only, never the schema.
- They do **not** survive step 4. Since `payments` rows are the shop's record of money that changed
  hands, a schema rollback destroys accounting history, not just app state.
- No migration in this release is data-lossy on the way UP: the four `up` migrations only create.
  The danger is entirely in the reversal direction.
- There is no export path out of the app (no CSV export, no report endpoint), so "copy the data out
  before reversing" means `pg_dump` or nothing.

## Who decides

**bangnk** triggers a rollback — nobody else, and no agent. The shop owner can *ask* for it (they
own the business impact); the decision and the commands are bangnk's.
