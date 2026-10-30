#!/usr/bin/env bash
# Verifies production and FAILS on any mismatch (unlike WSL verify-external.sh, which only prints).
# The status-code checks run ON THE VPS against nginx with the real names (curl --resolve to
# 127.0.0.1:443, real certificate), because Cloudflare Bot Fight Mode challenges GitHub runner IPs
# (2026-10-31) — so this proves nginx + both apps, not the Cloudflare edge; for the edge run WSL
# verify-external.sh. From the runner only the origin-by-IP checks run: they never touch Cloudflare
# and must stay 000 (ufw lets only Cloudflare reach 80/443).
set -uo pipefail
. "$(dirname "$0")/lib.sh"
set +e
fail=0

echo "== from the runner: the origin must not answer by IP"
for d in "$DOMAIN" "$WEB_DOMAIN"; do
  got=$(curl -s -o /dev/null -m 5 -k -w '%{http_code}' --resolve "$d:443:$DEPLOY_HOST" "https://$d/")
  if [ "$got" = 000 ]; then echo "ok   origin by IP, SNI=$d                     000"
  else echo "FAIL origin by IP, SNI=$d answered $got, want 000 (ufw must allow only Cloudflare)"; fail=1; fi
done

echo "== on the host: nginx with the real names"
rssh "DOMAIN=$DOMAIN WEB_DOMAIN=$WEB_DOMAIN bash -s" <<'EOF' || fail=1
fail=0
# --retry covers the API still starting after a restart (502/503/504); HTTP codes are not errors here.
code() { local d=$1; shift; curl -s -o /dev/null -m 10 --retry 6 --retry-delay 5 -w '%{http_code}' --resolve "$d:443:127.0.0.1" "$@"; }
expect() {
  if [ "$3" = "$2" ]; then printf 'ok   %-44s %s\n' "$1" "$3"
  else printf 'FAIL %-44s got %s, want %s\n' "$1" "$3" "$2"; fail=1; fi
}
C="https://$DOMAIN"; W="https://$WEB_DOMAIN"
expect "fe /" 200 "$(code "$DOMAIN" "$C/")"
expect "fe /rentals" 200 "$(code "$DOMAIN" "$C/rentals")"
expect "api /api/v1/dresses without token" 401 "$(code "$DOMAIN" "$C/api/v1/dresses")"
expect "login with a wrong password" 422 "$(code "$DOMAIN" -X POST "$C/api/v1/auth/login" -H 'Content-Type: application/json' -d '{"username":"owner","password":"wrong-on-purpose"}')"
expect "public api /api/v1/public/dresses" 200 "$(code "$DOMAIN" "$C/api/v1/public/dresses")"
for p in / /bo-suu-tap /lien-he /robots.txt /sitemap.xml; do expect "web $p" 200 "$(code "$WEB_DOMAIN" "$W$p")"; done
expect "web unknown page" 404 "$(code "$WEB_DOMAIN" "$W/khong-co-trang-nay")"
expect "web /api/v1/public/dresses (closed)" 404 "$(code "$WEB_DOMAIN" "$W/api/v1/public/dresses")"

cat /opt/dress-rental/apps/web/run/.built 2>/dev/null | sed "s/^/web bundle: /"
PM2=$(pm2 jlist 2>/dev/null | node -e 'const l=JSON.parse(require("fs").readFileSync(0));for(const p of l)console.log("pm2",p.name,p.pm2_env.status,"restarts="+p.pm2_env.restart_time,"mem="+Math.round(p.monit.memory/1048576)+"MB")')
echo "$PM2"
for app in dress-api dress-web; do
  grep -qE "^pm2 $app online " <<<"$PM2" && echo "ok   pm2 $app online" || { echo "FAIL pm2 $app is not online"; fail=1; }
done
echo "mem available: $(free -m | awk '/^Mem:/{print $7}') MB | disk /: $(df -h / | awk 'NR==2{print $4" free of "$2}')"
echo "migrations: $(docker exec dress-db psql -U dress -d dress_rental -Atc 'SELECT count(*) FROM pgmigrations' 2>&1)"
exit $fail
EOF

[ $fail = 0 ] || { echo "::error::production verification failed — see FAIL lines above"; exit 1; }
echo "all checks passed"
