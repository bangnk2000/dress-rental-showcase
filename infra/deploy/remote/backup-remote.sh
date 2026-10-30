#!/usr/bin/env bash
# Runs ON THE VPS as /opt/dress-ops/backup-remote.sh — by cron (02:00 daily), by infra/deploy/backup.sh
# (GitHub Actions, which also installs this file) or by the WSL fallback backup-now.sh.
# pg_dump -Fc → rehearsal restore into a scratch db (row counts must match live) → sha256 →
# rclone copy to R2 daily/ (+ monthly/ on the 1st) → keep 7 local → ping healthchecks.io.
# Exit ≠ 0 (and /fail ping) on any failure so a missed backup is loud, not silent.
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
. /root/.dress-secrets
BUCKET="${R2_BUCKET:-dress-rental-backups}"
STAMP="${1:-$(date +%Y%m%d_%H%M%S)}"
FILE="/root/backups/dress_rental_${STAMP}.dump"
log() { printf '%s %s\n' "$(date -Is)" "$*"; }
ping_hc() { [ -n "${HC_PING_URL:-}" ] && curl -fsS -m 10 --retry 3 "${HC_PING_URL}$1" >/dev/null 2>&1 || true; }
trap 'rc=$?; if [ $rc -ne 0 ]; then log "BACKUP FAILED rc=$rc"; ping_hc /fail; fi' EXIT
mkdir -p /root/backups
log "start $FILE"

docker exec dress-db pg_dump -U dress -Fc -d dress_rental > "$FILE"
log "dump $(stat -c %s "$FILE") bytes"

# Rehearsal restore (release plan P5: a backup only counts once a restore is proven).
PSQL="docker exec dress-db psql -U dress"
$PSQL -d postgres -q -c 'DROP DATABASE IF EXISTS dress_restore_test;'
$PSQL -d postgres -q -c 'CREATE DATABASE dress_restore_test;'
docker exec -i dress-db pg_restore -U dress -d dress_restore_test --no-owner < "$FILE"
Q="SELECT 'staff_users' t, count(*) n FROM staff_users
   UNION ALL SELECT 'dresses', count(*) FROM dresses
   UNION ALL SELECT 'categories', count(*) FROM categories
   UNION ALL SELECT 'dress_price_history', count(*) FROM dress_price_history
   UNION ALL SELECT 'rentals', count(*) FROM rentals
   UNION ALL SELECT 'rental_items', count(*) FROM rental_items
   UNION ALL SELECT 'payments', count(*) FROM payments
   UNION ALL SELECT 'qr_links', count(*) FROM qr_links
   ORDER BY 1"
live=$($PSQL -d dress_rental -Atc "$Q")
rest=$($PSQL -d dress_restore_test -Atc "$Q")
$PSQL -d postgres -q -c 'DROP DATABASE dress_restore_test;'
if [ "$live" != "$rest" ]; then
  log "RESTORE TEST MISMATCH"; echo "live:"; echo "$live"; echo "restored:"; echo "$rest"; exit 4
fi
log "restore rehearsal OK: $(echo "$live" | tr '\n' ' ')"
printf '%s\n' "$live" > "${FILE%.dump}.counts"
sha256sum "$FILE" | tee "${FILE}.sha256"

# Offsite copy (Cloudflare R2). Skipped with a loud line until r2-setup.sh has run.
if rclone listremotes 2>/dev/null | grep -qx 'r2:'; then
  rclone copy "$FILE" "r2:${BUCKET}/daily/" --s3-no-check-bucket
  rclone copy "${FILE}.sha256" "r2:${BUCKET}/daily/" --s3-no-check-bucket
  rclone check --one-way --include "$(basename "$FILE")" /root/backups "r2:${BUCKET}/daily" 2>&1 | tail -1
  if [ "$(date +%d)" = 01 ]; then
    rclone copy "$FILE" "r2:${BUCKET}/monthly/" --s3-no-check-bucket
    log "monthly copy done"
  fi
  log "offsite OK: r2:${BUCKET}/daily/$(basename "$FILE")"
else
  log "WARNING: rclone remote r2 not configured — backup is LOCAL ONLY (run r2-setup.sh)"
fi

# Local retention: 7 dumps (small disk).
ls -t /root/backups/dress_rental_*.dump 2>/dev/null | tail -n +8 | while read -r old; do
  rm -f "$old" "${old}.sha256" "${old%.dump}.counts"; log "pruned $(basename "$old")"
done
ping_hc ""
log "done"
