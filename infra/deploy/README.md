# infra/deploy — production deploy from GitHub Actions

Routine redeploys of the Tencent VPS (`cms.example.com` staff SPA + API, `example.com` public site)
run as the manual workflow [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).
GitHub lists it under Actions only once it is on `master`.
It replaces RUNBOOK §7 ("Redeploy thường ngày") of the out-of-repo WSL set
`~/deploy-dress/tencent/`. That set stays the **fallback**, and it alone covers the one-off work:
provision, restore, harden, TLS, `serve.sh` (nginx/pm2 vhosts), media setup.

## Run a deploy

Actions → **deploy** → Run workflow.

| Input | Meaning |
| --- | --- |
| `ref` | Commit to ship. Must be on `master` and have a green `ci` push run. Default `master`. |
| `only` | `auto` = deploy what changed since the SHA recorded in `/opt/dress-rental/.deployed`; `all`, `be`, `fe`, `web` force a part. |
| `backup` | `auto` = proven backup when the range touches `apps/be/migrations/`; `always` = backup anyway. |
| `bump` | The new version: `patch` (default) = fixes/UI, `minor` = new feature or migration, `major` = big change. |

Steps, in this order (RUNBOOK §7 as code):

1. **plan.sh** diffs the recorded SHA against the target. Paths (`lib.sh` `part_re`):
   - `apps/be/`, `be.sh` or `remote/build-remote.sh` → be
   - `apps/fe/` or `fe.sh` → fe
   - `apps/web/` or `web.sh` → web
   - `package.json`, `pnpm-lock.yaml`, `packages/` or `lib.sh` → all three
   - `AGENTS.md` / `README.md` anywhere → nothing (they never change a build)

   A missing or unknown recorded SHA means deploy everything **and back up first**, because the
   migrations in range are unknown. An ssh failure while reading it aborts the run. If the target is
   older than the recorded SHA and the range touches a migration, it **refuses**: `build-remote.sh`
   only migrates up, so that rollback is manual.

   It also names the version (see [Versions](#versions)): the tag already on the target, else the
   highest `vX.Y.Z` bumped by `bump`, else — for a partial run — `vX.Y.Z+sha7`. A new version also
   rebuilds the FE (only with `only=auto`) so the CMS footer always shows the production version.
2. **backup.sh** runs only when a migration is in range. It installs `remote/backup-remote.sh` (the same
   script cron runs) and runs it: dump, rehearsal restore, sha256, then R2. It fails if R2 is not
   configured. The dump never leaves the VPS.
3. **be.sh**: `git archive` of the target goes to the VPS, then `remote/build-remote.sh` runs over ssh.
   That stops the API, keeps the running build as `apps/be/dist.prev`, installs, runs nest build,
   migrates and starts the API again (**API down ~1–2 min**). If install or build fails before the
   migration and the lockfile is unchanged, it puts `dist.prev` back and restarts the API.
4. **fe.sh**: Vite build on the runner, then an atomic swap of `apps/fe/dist` (the old one becomes
   `dist.prev`).
5. **web.sh**: `next build` on the runner, **after** the BE because it prerenders from the live catalogue.
   It reads the catalogue through `ssh -L 3000:127.0.0.1:3000`, not through Cloudflare (see below).
   The standalone server is swapped atomically (the old one becomes `run.prev`), then pm2 restarts
   `dress-web` and runs local checks.
6. **verify.sh**: checks the status codes **on the VPS**, against nginx with the real names, and that
   pm2 `dress-api` and `dress-web` are online. From the runner, the origin must not answer by IP (000).
   The job goes red on any mismatch.
7. **record.sh** writes `.deployed` (with `version=`) and appends one line to `.deploy-history`, but
   only after everything above passed and only when the run covered every changed part. A partial
   run (`only=web` while the BE also changed) leaves the old record, so the next `auto` run still
   sees the BE as pending.
8. Job **tag** (the only job with `contents: write`; it never runs target code) creates the annotated
   tag `vX.Y.Z` on the target and a GitHub Release with generated notes — only when step 7 ran and the
   version is new. If it fails, production already runs that version: tag it by hand.

After a deploy, update `deploy.deployed` on the shipped ledger entries and the **Production** bullet
in the root `AGENTS.md` (with the version), as before.

## Versions

Design: [`docs/design/deploy-versioning.md`](../../docs/design/deploy-versioning.md) (NFR-07).

- Every complete, verified deploy is a git tag `vX.Y.Z` + a GitHub Release. Which version runs:
  the CMS footer, `https://cms.example.com/version.json`, `/opt/dress-rental/.deployed`.
- `/opt/dress-rental/.deploy-history`: one line per deploy / rollback, appended, never rewritten.
- Every build carries its metadata: `apps/be/dist/.built`, `apps/fe/dist/version.json`,
  `apps/web/run/.built` — `sha` (the code), `version`, `ops` (the commit whose deploy scripts made
  it, information only), `env` (sha256 of the BE `.env` / web pm2 config it was deployed with), and
  for the BE `lock` (sha256 of `pnpm-lock.yaml`).
- Each part keeps ONE previous build: `apps/be/dist.prev`, `apps/fe/dist.prev`, `apps/web/run.prev`.
  A redeploy of the same commit does not rotate, so `.prev` never becomes a copy of the live build.
- **One-time, before the first versioned deploy:** `bootstrap-version.sh <sha in .deployed>` seeds
  the live builds' metadata + the first history line and tags it `v1.0.0`.
- Offline proof of the decisions: `bash infra/deploy/test/deploy-versioning.test.sh` (CI job
  `deploy-scripts`).

The job checks out two trees:

- `ops/` is the workflow's own commit. It holds the scripts and the full history.
- `target/` is the commit being shipped, and it is what gets built.

So a rollback to a commit older than `infra/deploy/` still works, and every run uses the current scripts.

## One-time setup

Repo Settings → Secrets and variables → Actions → **repository secrets**:

- `DEPLOY_HOST`: the VPS IP. It is kept as a secret because the origin hides behind Cloudflare.
- `DEPLOY_SSH_KEY`: the private half of a key used **only** for this workflow.
- `DEPLOY_KNOWN_HOSTS`: the output of `ssh-keyscan -t ed25519 <IP>`, verified once against the VPS.
  Host-key checking is strict.

The key's public half goes into `/root/.ssh/authorized_keys` on the VPS. `harden.sh` already allows
`22/tcp` from anywhere, with fail2ban on sshd.

### Why the runner never goes through Cloudflare

Cloudflare **Bot Fight Mode** serves a Managed Challenge to GitHub runner IPs (Azure). This was seen
on the first run, 2026-10-31. The Free plan has no way to skip it for one client, and the owner chose
to keep it on (2026-10-31). So the runner talks to the VPS only over ssh:

- **Build data:** the WSL `harden-remote.sh` sshd drop-in allows `AllowTcpForwarding local` with
  `PermitOpen 127.0.0.1:3000` and `PermitListen none`. That means a local forward to the API on
  loopback and nothing else. Re-run `harden.sh` from WSL after changing it.
- **Verify:** checks nginx on the VPS (`curl --resolve <name>:443:127.0.0.1`). It does not check the
  Cloudflare edge; WSL `verify-external.sh` still does that.

The job uses no GitHub Environment. A private repo on the Free plan has no environment secrets and
no required reviewers, so the gate is the manual dispatch, which only people with write access can
trigger. On a paid plan, move the secrets to an environment `production` with a required reviewer
and add `environment: production` to the job.

## Rollback

**Fast (no build, under a minute):** Actions → **rollback** → Run (tick `dry_run` to only see the plan).

- Target: the deploy before the current one in `.deploy-history`. If a deploy failed after swapping
  some part (that slot is newer than `.deployed`), the target is `.deployed` itself.
- Per part it keeps the live build (already equivalent to the target), or swaps `.prev` back in,
  or refuses. One refusal refuses everything, before anything is touched. It refuses when:
  - `apps/be/migrations/` differs between the target and the live BE build (manual, RUNBOOK);
  - the BE builds were installed from different `pnpm-lock.yaml` files;
  - the live `apps/be/.env` / dress-web pm2 config is not the one the previous build was deployed with
    (each build records `env=<sha256>` of it; a rollback never rewrites them);
  - a build has no metadata (built before versioning, or by the WSL fallback).
- BE swap = `pm2 restart dress-api` (seconds). Then verify.sh, then record.sh (`kind=rollback`).
- Pressing it again goes forward to the build just rolled back (the slots swap back).
- Verify red after a swap → nothing is recorded; decide by hand (another press swaps back again).
- CMS devices keep the cached build until staff accept the update prompt / reload (PWA).

**Rebuild (fallback, or across what fast rollback refuses):** run **deploy** with `ref=<vX.Y.Z or
older master SHA>` and `only=all`. A rollback across a migration is refused by plan.sh too and stays
manual (WSL set + RUNBOOK).

## Keep in step

`remote/build-remote.sh` and `remote/backup-remote.sh` started as copies of the WSL files. If either
side changes, copy it to the other (or retire the WSL copy once the workflow has proven itself).
The WSL fallback (`sync.sh`, `build.sh`) makes no version: its builds carry `sha=unknown`, which fast
rollback never swaps back (deploy-versioning A9).
