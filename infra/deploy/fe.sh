#!/usr/bin/env bash
# Builds the staff SPA on the runner (the 2 GB VPS never runs Vite) and swaps apps/fe/dist atomically.
# Port of WSL febuild.sh; expects `pnpm install` already done on the target checkout.
# Keeps the build it replaces as apps/fe/dist.prev — the slot rollback.sh swaps back
# (docs/design/deploy-versioning.md §3.3) — unless that build is the same commit (a redeploy).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${VERSION:=unversioned}" "${OPS_SHA:=unknown}"
cd "$TREE"
SHA=$(git rev-parse HEAD)
# Inlined at BUILD. VITE_API_BASE_URL stays EMPTY: same-origin /api behind nginx.
export VITE_API_BASE_URL=
export VITE_IMAGE_BASE_URL="$IMAGE_BASE_URL"
export VITE_WEB_ORIGIN="https://$WEB_DOMAIN"
export VITE_APP_VERSION="$VERSION" VITE_APP_SHA="$SHA"   # the CMS footer label (deploy-versioning §3.5)
echo "building fe $VERSION at ${SHA:0:7} with node $(node -v) / pnpm $(pnpm -v)"
echo "VITE_IMAGE_BASE_URL=$VITE_IMAGE_BASE_URL VITE_WEB_ORIGIN=$VITE_WEB_ORIGIN"
pnpm --filter fe build
test -f apps/fe/dist/index.html
# Slot metadata, compact one-line JSON (read by lib.sh meta_get). Served publicly at /version.json (A8).
printf '{"version":"%s","sha":"%s","ops":"%s","date":"%s"}\n' "$VERSION" "$SHA" "$OPS_SHA" "$(date -Is)" >apps/fe/dist/version.json

tar -C apps/fe -czf - dist | rssh "set -e; mkdir -p $REMOTE_DIR/apps/fe && cd $REMOTE_DIR/apps/fe \
  && rm -rf dist.new && mkdir dist.new && tar --no-same-owner -xzf - -C dist.new --strip-components=1 \
  && if [ -d dist ] && ! grep -q '\"sha\":\"$SHA\"' dist/version.json 2>/dev/null; then rm -rf dist.prev && mv dist dist.prev; else rm -rf dist; fi \
  && mv dist.new dist \
  && ls -la dist/index.html dist/sw.js && du -sh dist && cat dist/version.json \
  && echo \"previous slot: \$(cat dist.prev/version.json 2>/dev/null || echo none)\""
