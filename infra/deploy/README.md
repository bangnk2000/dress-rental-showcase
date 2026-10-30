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

Steps, in this order (RUNBOOK §7 as code):

1. **plan.sh** diffs the recorded SHA against the target. Paths:
   - `apps/be/`, `be.sh` or `remote/build-remote.sh` → be
   - `apps/fe/` or `fe.sh` → fe
   - `apps/web/` or `web.sh` → web
   - `package.json`, `pnpm-lock.yaml`, `packages/` or `lib.sh` → all three

   A missing or unknown recorded SHA means deploy everything **and back up first**, because the
   migrations in range are unknown. An ssh failure while reading it aborts the run. If the target is
   older than the recorded SHA and the range touches a migration, it **refuses**: `build-remote.sh`
   only migrates up, so that rollback is manual.
2. **backup.sh** runs only when a migration is in range. It installs `remote/backup-remote.sh` (the same
   script cron runs) and runs it: dump, rehearsal restore, sha256, then R2. It fails if R2 is not
   configured. The dump never leaves the VPS.
3. **be.sh**: `git archive` of the target goes to the VPS, then `remote/build-remote.sh` runs over ssh.
   That stops the API, installs, runs nest build, migrates and starts the API again (**API down ~1–2 min**).
4. **fe.sh**: Vite build on the runner, then an atomic swap of `apps/fe/dist`.
5. **web.sh**: `next build` on the runner, **after** the BE because it prerenders from the live public API.
   The standalone server is swapped atomically, then pm2 restarts `dress-web` and runs local checks.
6. **verify.sh**: asserts the external status codes (through Cloudflare, origin-by-IP must be 000) and
   that pm2 `dress-api` and `dress-web` are online. The job goes red on any mismatch.
7. **record.sh** writes `.deployed`, but only after everything above passed and only when the run
   covered every changed part. A partial run (`only=web` while the BE also changed) leaves the
   old record, so the next `auto` run still sees the BE as pending.

After a deploy, update `deploy.deployed` on the shipped ledger entries and the **Production** bullet
in the root `AGENTS.md`, as before.

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

The job uses no GitHub Environment. A private repo on the Free plan has no environment secrets and
no required reviewers, so the gate is the manual dispatch, which only people with write access can
trigger. On a paid plan, move the secrets to an environment `production` with a required reviewer
and add `environment: production` to the job.

## Rollback

Run the workflow with `ref=<older master SHA>` and `only=all`. A rollback across a migration is refused
by plan.sh and stays manual (WSL set + RUNBOOK).

## Keep in step

`remote/build-remote.sh` and `remote/backup-remote.sh` started as copies of the WSL files. If either
side changes, copy it to the other (or retire the WSL copy once the workflow has proven itself).
