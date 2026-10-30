#!/usr/bin/env bash
# Builds the public site (apps/web) on the runner — `next build` never runs on the 2 GB VPS — ships
# its standalone server to $REMOTE_DIR/apps/web/run atomically and (re)starts pm2 dress-web.
# Port of WSL webbuild.sh; read that file's header for the why behind each rule kept here:
#  - the build prerenders every published listing through the anonymous public API of the staff
#    origin (60/min per IP throttle → retry on 429 after a full window, keeping .next/cache);
#  - HOSTNAME=localhost at runtime, NEVER 127.0.0.1 (307 loop / 500 behind nginx);
#  - SITE_URL / NEXT_PUBLIC_*IMAGE_BASE_URL are baked at build; a local .env never ships.
# Expects `pnpm install` already done on the target checkout. Runs after be.sh (BE before web).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"
SHA=$(git rev-parse HEAD)
grep -q "output: 'standalone'" apps/web/next.config.ts \
  || { echo "::error::apps/web/next.config.ts has no output: 'standalone' — this commit cannot be deployed by this script"; exit 1; }
BUILD_API_URL="${BUILD_API_URL:-https://$DOMAIN}"
WEB_BUILD_ATTEMPTS="${WEB_BUILD_ATTEMPTS:-3}"
PUBLISHED=$(curl -sf -m 15 --retry 3 --retry-delay 65 "$BUILD_API_URL/api/v1/public/dresses" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(Array.isArray(j)?j.length:(j.items??j.data??[]).length)})') \
  || { echo "::error::cannot read the prod catalogue at $BUILD_API_URL/api/v1/public/dresses (dress-api down, or Cloudflare blocking the runner IP?)"; exit 1; }
echo "prod catalogue: $PUBLISHED published listing(s) at $BUILD_API_URL"
[ "$PUBLISHED" != 0 ] || echo "::warning::nothing is published — the site builds with an EMPTY catalogue"

echo "building web at ${SHA:0:7} for https://$WEB_DOMAIN (images $IMAGE_BASE_URL, data $BUILD_API_URL) with node $(node -v)"
rm -rf apps/web/.next
BUILD_LOG=$(mktemp); trap 'rm -f "$BUILD_LOG"' EXIT
for attempt in $(seq 1 "$WEB_BUILD_ATTEMPTS"); do
  if env -u NODE_ENV SITE_URL="https://$WEB_DOMAIN" NEXT_PUBLIC_IMAGE_BASE_URL="$IMAGE_BASE_URL" NEXT_PUBLIC_STATIC_IMAGE_BASE_URL="https://$WEB_DOMAIN" API_URL="$BUILD_API_URL" \
       pnpm --filter web build 2>&1 | tee "$BUILD_LOG"; then
    break
  fi
  if grep -qE 'HTTP 429|ThrottlerException: Too Many Requests' "$BUILD_LOG"; then
    failure="public API throttling (HTTP 429)"; retry_delay=65
  elif grep -qE 'fetch failed|ConnectTimeoutError|UND_ERR_|ETIMEDOUT|ECONNRESET|EAI_AGAIN' "$BUILD_LOG"; then
    failure="network errors"; retry_delay=0
  else
    echo "::error::web build failed (not a network error or HTTP 429) — see the output above"; exit 1
  fi
  [ "$attempt" -lt "$WEB_BUILD_ATTEMPTS" ] \
    || { echo "::error::web build failed $attempt× on $failure reading $BUILD_API_URL — nothing shipped"; exit 1; }
  echo "== $failure during prerender (attempt $attempt/$WEB_BUILD_ATTEMPTS) — retrying in $retry_delay s, keeping .next/cache"
  [ "$retry_delay" -eq 0 ] || sleep "$retry_delay"
done

S=apps/web/.next/standalone
test -f "$S/apps/web/server.js"
cp -r apps/web/.next/static "$S/apps/web/.next/static"
[ -d apps/web/public ] && cp -r apps/web/public "$S/apps/web/public"
find "$S" -maxdepth 3 -name '.env*' -type f -print -delete | sed 's/^/dropped from bundle: /'
printf 'sha=%s date=%s site=https://%s images=%s published_at_build=%s by=github-actions\n' "$SHA" "$(date -Is)" "$WEB_DOMAIN" "$IMAGE_BASE_URL" "$PUBLISHED" >"$S/.built"
du -sh "$S"

echo "== ship + swap + pm2 dress-web"
tar -C "$S" -czf - . | rssh "set -e; mkdir -p $REMOTE_DIR/apps/web && cd $REMOTE_DIR/apps/web \
  && rm -rf run.new && mkdir run.new && tar --no-same-owner -xzf - -C run.new \
  && rm -rf run.old && { [ -d run ] && mv run run.old || true; } && mv run.new run && rm -rf run.old \
  && cat run/.built"
rssh 'bash -s' <<EOF
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:\$PATH
install -d $OPS_DIR
cat > $OPS_DIR/dress-web.config.cjs <<'CFG'
// Written by webbuild.sh / infra/deploy/web.sh — pm2 app for the public site (apps/web standalone server).
module.exports = {
  apps: [{
    name: 'dress-web',
    cwd: '$REMOTE_DIR/apps/web/run/apps/web',
    script: 'server.js',
    time: true,
    max_memory_restart: '300M',
    exp_backoff_restart_delay: 1000,
    env: {
      NODE_ENV: 'production',
      PORT: '$WEB_PORT',
      HOSTNAME: 'localhost',
      API_URL: 'http://127.0.0.1:3000',
      SITE_URL: 'https://$WEB_DOMAIN',
    },
  }],
};
CFG
pm2 startOrRestart $OPS_DIR/dress-web.config.cjs --update-env >/dev/null
pm2 save >/dev/null
curl -s -o /dev/null --retry 20 --retry-connrefused --retry-delay 1 http://localhost:$WEB_PORT/robots.txt || true
H=(-H 'Host: $WEB_DOMAIN' -H 'X-Forwarded-Proto: https')
fail=0
for pair in /:200 /bo-suu-tap:200 /lien-he:200 /robots.txt:200 /khong-co-trang-nay:404; do
  p=\${pair%:*} want=\${pair##*:}
  got=\$(curl -s "\${H[@]}" -o /dev/null -w '%{http_code}' http://localhost:$WEB_PORT\$p)
  printf 'web %-22s -> %s (expect %s)\n' "\$p" "\$got" "\$want"
  [ "\$got" = "\$want" ] || fail=1
done
ss -ltnH "sport = :$WEB_PORT" | awk '{print \$4}' | grep -qvE '^(127\.0\.0\.1|\[::1\]):' && { echo "dress-web listens beyond loopback"; fail=1; }
[ \$fail = 0 ] || { echo "dress-web local checks FAILED"; exit 1; }
EOF
