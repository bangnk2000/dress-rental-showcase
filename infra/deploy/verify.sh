#!/usr/bin/env bash
# Verifies production from OUTSIDE (the runner, through Cloudflare) and the host over ssh, and FAILS
# on any mismatch — unlike WSL verify-external.sh, which only prints codes next to "(expect …)".
set -uo pipefail
. "$(dirname "$0")/lib.sh"
set +e
fail=0
# --retry covers the API still starting after a restart (502/503/504); HTTP codes are not errors here.
code() { curl -s -o /dev/null -m 10 --retry 6 --retry-delay 5 -w '%{http_code}' "$@"; }
expect() {  # expect <label> <want> <got>
  if [ "$3" = "$2" ]; then printf 'ok   %-44s %s\n' "$1" "$3"
  else printf 'FAIL %-44s got %s, want %s\n' "$1" "$3" "$2"; fail=1; fi
}

C="https://$DOMAIN"
echo "== staff origin $C"
expect "fe /" 200 "$(code "$C/")"
expect "fe /rentals" 200 "$(code "$C/rentals")"
expect "api /api/v1/dresses without token" 401 "$(code "$C/api/v1/dresses")"
expect "login with a wrong password" 422 "$(code -X POST "$C/api/v1/auth/login" -H 'Content-Type: application/json' -d '{"username":"owner","password":"wrong-on-purpose"}')"
expect "public api /api/v1/public/dresses" 200 "$(code "$C/api/v1/public/dresses")"
expect "origin by IP, SNI=$DOMAIN (Cloudflare only)" 000 "$(curl -s -o /dev/null -m 5 -k -w '%{http_code}' --resolve "$DOMAIN:443:$DEPLOY_HOST" "https://$DOMAIN/")"

W="https://$WEB_DOMAIN"
echo "== public site $W"
for p in / /bo-suu-tap /lien-he /robots.txt /sitemap.xml; do expect "web $p" 200 "$(code "$W$p")"; done
expect "web unknown page" 404 "$(code "$W/khong-co-trang-nay")"
expect "web /api/v1/public/dresses (closed)" 404 "$(code "$W/api/v1/public/dresses")"

echo "== on the host"
HOST_OUT=$(rssh '
  cat /opt/dress-rental/apps/web/run/.built 2>/dev/null | sed "s/^/web bundle: /"
  pm2 jlist 2>/dev/null | node -e "const l=JSON.parse(require(\"fs\").readFileSync(0));for(const p of l)console.log(\"pm2\",p.name,p.pm2_env.status,\"restarts=\"+p.pm2_env.restart_time,\"mem=\"+Math.round(p.monit.memory/1048576)+\"MB\")"
  echo "mem available: $(free -m | awk "/^Mem:/{print \$7}") MB | disk /: $(df -h / | awk "NR==2{print \$4\" free of \"\$2}")"
  echo "migrations: $(docker exec dress-db psql -U dress -d dress_rental -Atc "SELECT count(*) FROM pgmigrations" 2>&1)"
')
echo "$HOST_OUT"
for app in dress-api dress-web; do
  grep -qE "^pm2 $app online " <<<"$HOST_OUT" && echo "ok   pm2 $app online" || { echo "FAIL pm2 $app is not online"; fail=1; }
done

[ $fail = 0 ] || { echo "::error::production verification failed — see FAIL lines above"; exit 1; }
echo "all checks passed"
