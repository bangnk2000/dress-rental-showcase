#!/usr/bin/env bash
# Runs ON THE VPS (piped over ssh by infra/deploy/be.sh, or by the WSL fallback build.sh). BE ONLY: install be deps, write .env (keeps the shop's knobs), nest build,
# migrate when the DB already has a schema, restart the API. NEVER builds fe/qr-admin here
# (2 GB RAM → the OOM killer would hit the API or Postgres). No seed: accounts come from the restore.
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:$PATH
. /root/.dress-secrets
cd /opt/dress-rental

# Keep runtime knobs across redeploys; first install = the LAN's values (1 day / 20 000 đ).
BUFFER_DAYS=$(sed -n 's/^CLEANING_BUFFER_DAYS=//p' apps/be/.env 2>/dev/null || true)
[ -n "$BUFFER_DAYS" ] || BUFFER_DAYS=1
LATE_FEE=$(sed -n 's/^LATE_FEE_PER_DRESS_PER_DAY=//p' apps/be/.env 2>/dev/null || true)
[ -n "$LATE_FEE" ] || LATE_FEE=20000
echo "knobs: CLEANING_BUFFER_DAYS=$BUFFER_DAYS LATE_FEE_PER_DRESS_PER_DAY=$LATE_FEE"
cat > apps/be/.env <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://dress:${DB_PASSWORD}@127.0.0.1:5432/dress_rental
LOG_LEVEL=info
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_TTL_SEC=900
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_TTL_SEC=2592000
CLEANING_BUFFER_DAYS=${BUFFER_DAYS}
LATE_FEE_PER_DRESS_PER_DAY=${LATE_FEE}
SEED_OWNER_USERNAME=owner
SEED_OWNER_PASSWORD=unused-data-comes-from-backup
# Photo upload (FR-CAT-10). The secrets file stores them as MEDIA_R2_* (media-setup.sh) because its
# R2_* keys belong to the BACKUP bucket/token; the BE reads R2_*. Any empty → only
# POST /api/v1/photos/upload-urls answers 503, the rest of the app runs.
R2_ACCOUNT_ID=${MEDIA_R2_ACCOUNT_ID:-}
R2_ACCESS_KEY_ID=${MEDIA_R2_ACCESS_KEY_ID:-}
R2_SECRET_ACCESS_KEY=${MEDIA_R2_SECRET_ACCESS_KEY:-}
R2_BUCKET=${MEDIA_R2_BUCKET:-}
IMAGE_PUBLIC_BASE_URL=${MEDIA_IMAGE_PUBLIC_BASE_URL:-}
EOF
chmod 600 apps/be/.env
if [ -n "${MEDIA_R2_ACCESS_KEY_ID:-}" ] && [ -n "${MEDIA_R2_BUCKET:-}" ]; then
  echo "photo upload: ON (bucket ${MEDIA_R2_BUCKET}, public ${MEDIA_IMAGE_PUBLIC_BASE_URL:-?})"
else
  echo "photo upload: OFF — no MEDIA_R2_* in /root/.dress-secrets (run media-setup.sh); upload-urls answers 503"
fi

# Free the RAM while pnpm + nest build run: stop the API first, start it again at the end.
API_EXISTS=0
if pm2 describe dress-api >/dev/null 2>&1; then
  API_EXISTS=1
  pm2 stop dress-api >/dev/null
  echo "api stopped for the build"
fi

echo "== pnpm install (be + its deps only)"
pnpm install --frozen-lockfile --filter be...
echo "== nest build (heap capped at 1 GB)"
NODE_OPTIONS=--max-old-space-size=1024 pnpm --filter be build
test -f apps/be/dist/main.js && echo "build OK: apps/be/dist/main.js"

export DATABASE_URL="postgres://dress:${DB_PASSWORD}@127.0.0.1:5432/dress_rental"
HAS_SCHEMA=$(docker exec dress-db psql -U dress -d dress_rental -Atc "SELECT to_regclass('public.pgmigrations') IS NOT NULL")
if [ "$HAS_SCHEMA" = t ]; then
  echo "== migrate"
  pnpm --filter be migrate
  docker exec dress-db psql -U dress -d dress_rental -Atc "SELECT 'migrations=' || count(*) FROM pgmigrations;"
else
  echo "DB is EMPTY — not migrating and not seeding on purpose: schema + real accounts arrive with restore.sh (next step)."
fi

if [ "$API_EXISTS" = 1 ]; then
  pm2 restart dress-api --update-env >/dev/null
  echo "api restarted"
fi
free -m | head -2
