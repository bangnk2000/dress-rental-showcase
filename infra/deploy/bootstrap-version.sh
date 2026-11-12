#!/usr/bin/env bash
# ONE-TIME (docs/design/deploy-versioning.md §6 step 1): names what production runs today v1.0.0 and
# seeds the slot metadata the live builds were deployed without, so the FIRST versioned deploy can
# already be rolled back. Run from a checkout with push rights, after the versioning scripts are on
# master and BEFORE the first deploy that uses them:
#   DEPLOY_HOST=<ip> DEPLOY_SSH_KEY_FILE=~/.ssh/<key> DEPLOY_KNOWN_HOSTS_FILE=~/.ssh/known_hosts \
#     bash infra/deploy/bootstrap-version.sh <sha-production-runs>
# Refuses unless .deployed names exactly <sha>, no vX.Y.Z tag exists yet and there is no history.
# The live apps/be/.env and dress-web pm2 config are hashed as the builds' env= (they were written by
# the deploy that made those builds). BOOT_OPS = the commit whose scripts made them (default <sha>:
# informational only); BOOT_VERSION defaults to v1.0.0 (O3).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"
SHA=$(git rev-parse --verify "${1:?usage: bootstrap-version.sh <sha production runs>}^{commit}")
OPS=$(git rev-parse --verify "${BOOT_OPS:-$SHA}^{commit}")
VERSION=${BOOT_VERSION:-v1.0.0}
grep -qE "$SEMVER_RE" <<<"$VERSION" || { echo "BOOT_VERSION must be vX.Y.Z"; exit 1; }
git fetch -q --tags origin
[ -z "$(latest_version)" ] || { echo "refused: tag $(latest_version) already exists — bootstrap is one-time"; exit 1; }
git merge-base --is-ancestor "$SHA" origin/master || { echo "refused: $SHA is not on origin/master"; exit 1; }

echo "== seeding $VERSION = ${SHA:0:7} (ops ${OPS:0:7}) on the VPS"
rssh "D=$REMOTE_DIR O=$OPS_DIR SHA=$SHA OPS=$OPS VERSION=$VERSION bash -s" <<'EOF'
set -euo pipefail
cd "$D"
live=$(sed -n 's/^sha=\([0-9a-f]*\).*/\1/p' .deployed 2>/dev/null || true)
[ "$live" = "$SHA" ] || { echo "refused: .deployed says '${live:-nothing}', not $SHA"; exit 1; }
[ ! -s .deploy-history ] || { echo "refused: .deploy-history already exists"; exit 1; }
[ -f apps/be/dist/main.js ] && [ -f apps/fe/dist/index.html ] && [ -f apps/web/run/.built ] \
  || { echo "refused: a live build is missing"; exit 1; }
web=$(sed -n 's/^sha=\([0-9a-f]*\).*/\1/p' apps/web/run/.built)
[ "$web" = "$SHA" ] || { echo "refused: the web bundle was built at '$web', not $SHA"; exit 1; }
[ -f apps/be/.env ] && [ -f "$O/dress-web.config.cjs" ] || { echo "refused: apps/be/.env or the dress-web pm2 config is missing"; exit 1; }
now=$(date -Is)
lock=$(sha256sum pnpm-lock.yaml | cut -c1-64)
be_env=$(sha256sum apps/be/.env | cut -c1-64)
web_env=$(sha256sum "$O/dress-web.config.cjs" | cut -c1-64)
printf 'sha=%s version=%s ops=%s lock=%s env=%s date=%s seeded=bootstrap\n' "$SHA" "$VERSION" "$OPS" "$lock" "$be_env" "$now" >apps/be/dist/.built
printf '{"version":"%s","sha":"%s","ops":"%s","date":"%s"}\n' "$VERSION" "$SHA" "$OPS" "$now" >apps/fe/dist/version.json
grep -q ' version=' apps/web/run/.built || sed -i "1s/\$/ version=$VERSION ops=$OPS env=$web_env/" apps/web/run/.built
grep -q ' version=' .deployed || sed -i "1s/\$/ version=$VERSION/" .deployed
printf 'version=%s sha=%s kind=bootstrap parts=be,fe,web ops=%s date=%s by=bootstrap-version.sh run=\n' "$VERSION" "$SHA" "$OPS" "$now" >>.deploy-history
echo "-- be:  $(cat apps/be/dist/.built)"
echo "-- fe:  $(cat apps/fe/dist/version.json)"
echo "-- web: $(cat apps/web/run/.built)"
echo "-- .deployed: $(cat .deployed)"
echo "-- history: $(cat .deploy-history)"
EOF

echo "== tag $VERSION → ${SHA:0:7}"
git tag -a "$VERSION" "$SHA" -m "production $VERSION — seeded by infra/deploy/bootstrap-version.sh"
git push origin "refs/tags/$VERSION"
echo "done: production is $VERSION; the next deploy mints the next version and keeps this one as .prev"
