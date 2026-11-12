#!/usr/bin/env bash
# Offline proof for docs/design/deploy-versioning.md — no ssh, no VPS. Run from the repo root:
#   bash infra/deploy/test/deploy-versioning.test.sh
# Uses REAL commits of this repo (full history needed) so the path rules (lib.sh part_re) and the
# migration rule are exercised on real diffs:
#   A 5cd5646 → B 1067bc1 adds two migrations;  B → C bbf1421 changes apps/be (no migration, same lockfile);
#   C → D d2fbfb0 changes apps/fe + apps/{be,web}/AGENTS.md only.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEPLOY="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$DEPLOY/../.." && pwd)"
export DEPLOY_HOST=offline-test
A=5cd564622416dc674970e46473c895a671978367
B=1067bc1e0bc408c6e64995ab5a24383db578043e
C=bbf1421ddb0d42b034f7635946019b4f76333b74
D=d2fbfb044131dbfdc04849fc1cd0f9b8a2e7cb32
OLD_OPS=$(git -C "$REPO" rev-parse 68b4bec~1)   # before infra/deploy/remote/build-remote.sh existed
L=1111111111111111111111111111111111111111111111111111111111111111
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
pass=0 fail=0
ok()  { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; [ -z "${2:-}" ] || sed 's/^/     | /' <<<"$2"; }
for s in $A $B $C $D $OLD_OPS; do
  git -C "$REPO" cat-file -e "$s^{commit}" 2>/dev/null || { echo "missing commit $s — needs full history"; exit 2; }
done

# ── lib.sh ───────────────────────────────────────────────────────────────────────────────────────
(
  . "$DEPLOY/lib.sh"
  [ "$(bump_version v1.2.3 patch)" = v1.2.4 ] && [ "$(bump_version v1.2.3 minor)" = v1.3.0 ] \
    && [ "$(bump_version v1.2.3 major)" = v2.0.0 ] && echo bump
  [ "$(meta_get 'be sha=abc version=v1.0.1 ops=def lock=xyz' version)" = v1.0.1 ] \
    && [ "$(meta_get '{"version":"v2.0.0","sha":"f00","ops":"ba1"}' sha)" = f00 ] \
    && [ -z "$(meta_get 'web sha=abc' lock)" ] && echo meta
  [ -z "$(printf 'apps/be/AGENTS.md\napps/web/README.md\n' | part_files be)" ] \
    && [ -n "$(printf 'apps/be/AGENTS.md\napps/be/src/x.ts\n' | part_files be)" ] \
    && [ -n "$(echo pnpm-lock.yaml | part_files web)" ] && echo parts
) >"$TMP/lib.out" 2>&1
grep -qx bump "$TMP/lib.out" && ok "bump_version patch/minor/major" || bad "bump_version" "$(cat "$TMP/lib.out")"
grep -qx meta "$TMP/lib.out" && ok "meta_get reads key=value and compact JSON" || bad "meta_get" "$(cat "$TMP/lib.out")"
grep -qx parts "$TMP/lib.out" && ok "part_files: agent docs never rebuild a part (A10); shared files rebuild all" || bad "part_files" "$(cat "$TMP/lib.out")"

# ── plan.sh (a throw-away clone carries the tags; the real repo is never tagged) ───────────────────
# --no-tags: the real repo's v* tags must not leak in (the no-tag case and our own v1.0.0 need a clean slate).
git clone -q --shared --no-checkout --no-tags "$REPO" "$TMP/repo"
plan() {  # plan <name> <deployed> <target> <only> [bump]  → output in $TMP/<name>.{out,log}
  : >"$TMP/$1.out"
  DEPLOY_REPO_ROOT="$TMP/repo" PLAN_DEPLOYED_SHA="$2" TARGET_SHA="$3" ONLY="$4" BUMP="${5:-patch}" \
    GITHUB_OUTPUT="$TMP/$1.out" bash "$DEPLOY/plan.sh" >"$TMP/$1.log" 2>&1
}
has_out() { grep -qx "$2" "$TMP/$1.out"; }
plan notag "$C" "$D" auto && bad "plan refuses without any vX.Y.Z tag" "$(cat "$TMP/notag.log")" \
  || { grep -q 'no vX.Y.Z tag yet' "$TMP/notag.log" && ok "plan refuses without any vX.Y.Z tag" || bad "plan no-tag message" "$(cat "$TMP/notag.log")"; }
git -C "$TMP/repo" tag v1.0.0 "$C"
if plan p1 "$C" "$D" auto && has_out p1 be=false && has_out p1 fe=true && has_out p1 web=false \
   && has_out p1 record=true && has_out p1 mint=true && has_out p1 version=v1.0.1 && has_out p1 previous=v1.0.0; then
  ok "plan C→D: fe only (AGENTS.md ignored), mints v1.0.1"
else bad "plan C→D" "$(cat "$TMP/p1.log" "$TMP/p1.out")"; fi
if plan p2 "$C" "$D" auto minor && has_out p2 version=v1.1.0; then ok "plan bump=minor → v1.1.0"
else bad "plan bump=minor" "$(cat "$TMP/p2.log" "$TMP/p2.out")"; fi
if plan p3 "$D" "$C" auto && has_out p3 version=v1.0.0 && has_out p3 mint=false; then
  ok "plan to an already-tagged commit reuses its tag (no mint)"
else bad "plan reuse tag" "$(cat "$TMP/p3.log" "$TMP/p3.out")"; fi
if plan p4 "$B" "$D" be && has_out p4 record=false && has_out p4 mint=false && has_out p4 "version=v1.0.0+${D:0:7}"; then
  ok "plan partial run (only=be): version v1.0.0+sha7, no tag (A2)"
else bad "plan partial run" "$(cat "$TMP/p4.log" "$TMP/p4.out")"; fi
if plan p5 "$D" "$D" auto && has_out p5 mint=true && has_out p5 fe=true && has_out p5 be=false; then
  ok "plan same commit, untagged: names it and rebuilds only the CMS label (A5)"
else bad "plan same commit" "$(cat "$TMP/p5.log" "$TMP/p5.out")"; fi
if plan p6 "$B" "$A" auto; then bad "plan refuses going back across a migration" "$(cat "$TMP/p6.log")"
else grep -q 'rollback across a migration is manual' "$TMP/p6.log" && ok "plan refuses going back across a migration" || bad "plan migration message" "$(cat "$TMP/p6.log")"; fi

# ── rollback.sh (DRY_RUN; the VPS state comes from a fixture) ─────────────────────────────────────
rb() {  # rb <name> <expected exit> <pattern>…  — state from $TMP/<name>.state
  local name=$1 want=$2; shift 2
  : >"$TMP/$name.out"
  DRY_RUN=1 STATE_FILE="$TMP/$name.state" GITHUB_OUTPUT="$TMP/$name.out" bash "$DEPLOY/rollback.sh" >"$TMP/$name.log" 2>&1
  local got=$? miss=''
  for p in "$@"; do grep -qE -- "$p" "$TMP/$name.log" || miss="$miss [$p]"; done
  if [ "$got" = "$want" ] && [ -z "$miss" ]; then ok "rollback $name"
  else bad "rollback $name (exit $got, want $want; missing:$miss)" "$(cat "$TMP/$name.log")"; fi
}
E=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee   # a live env file hash
slots() {  # slots <be> <be.prev> <fe> <fe.prev> <web> <web.prev>  — each "sha ops lock env" or MISSING
  local k i=0 keys=(be be.prev fe fe.prev web web.prev) s o l e
  for k in "$@"; do
    if [ "$k" = MISSING ]; then echo "${keys[$i]} MISSING"; i=$((i + 1)); continue; fi
    read -r s o l e <<<"$k"
    case ${keys[$i]} in
      fe*) printf '%s {"version":"v-%s","sha":"%s","ops":"%s","date":"x"}\n' "${keys[$i]}" "${s:0:7}" "$s" "$o" ;;
      be*) printf '%s sha=%s version=v-%s ops=%s lock=%s env=%s date=x\n' "${keys[$i]}" "$s" "${s:0:7}" "$o" "$l" "$e" ;;
      *)   printf '%s sha=%s date=x site=s images=i published_at_build=1 by=gh version=v-%s ops=%s env=%s\n' "${keys[$i]}" "$s" "${s:0:7}" "$o" "$e" ;;
    esac
    i=$((i + 1))
  done
  printf 'be.env %s\nweb.env %s\n' "${LIVE_ENV:-$E}" "${LIVE_ENV:-$E}"
}
hist() { local s; for s in "$@"; do echo "history version=v-${s:0:7} sha=$s kind=deploy parts=be,fe,web ops=$s date=x"; done; }

{ slots "$D $D $L $E" "$C $C $L $E" "$D $D" "$C $C" "$D $D - $E" "$C $C - $E"; echo "deployed sha=$D version=v-d"; hist "$C" "$D"; } >"$TMP/fe-only.state"
rb fe-only 0 'be +keep' 'fe +swap' 'web +keep' 'would swap: fe$'

{ slots "$C $C $L $E" "$B $B $L $E" "$C $C" "$B $B" "$C $C - $E" "$B $B - $E"; echo "deployed sha=$C"; hist "$B" "$C"; } >"$TMP/be-swap.state"
rb be-swap 0 'be +swap' 'fe +swap' 'would swap: be fe'

# The deploy scripts changed between the two deploys (different ops) but wrote the same env files:
# exactly the first deploy after this feature ships — it must stay fast-rollbackable.
{ slots "$C $D $L $E" "$B $OLD_OPS $L $E" "$C $D" "$B $OLD_OPS" "$C $D - $E" "$B $OLD_OPS - $E"; echo "deployed sha=$C"; hist "$B" "$C"; } >"$TMP/scripts-changed-env-same.state"
rb scripts-changed-env-same 0 'be +swap' 'would swap: be fe'

{ slots "$C $C $L $E" "$B $B 2222 $E" "$C $C" "$B $B" "$C $C - $E" "$B $B - $E"; echo "deployed sha=$C"; hist "$B" "$C"; } >"$TMP/lock-differs.state"
rb lock-differs 1 'be +refuse +pnpm-lock.yaml differs' 'Fallback .*ref='"$B"

{ slots "$C $C $L $E" "$B $B $L ffff" "$C $C" "$B $B" "$C $C - $E" "$B $B - $E"; echo "deployed sha=$C"; hist "$B" "$C"; } >"$TMP/env-differs.state"
rb env-differs 1 'be +refuse +apps/be/.env is not the one'

{ slots "$B $B $L $E" "$A $A $L $E" "$B $B" "$A $A" "$B $B - $E" "$A $A - $E"; echo "deployed sha=$B"; hist "$A" "$B"; } >"$TMP/migration.state"
rb migration 1 'migrations differ'

{ slots "$C $C $L $E" "$B $B $L $E" "$D $D" "$C $C" "$C $C - $E" "$B $B - $E"; echo "deployed sha=$C"; hist "$B" "$C"; } >"$TMP/half-failed-deploy.state"
rb half-failed-deploy 0 'ahead of it: fe' "target: .deployed ${C:0:7}" 'would swap: fe$'

{ slots "$D $D $L $E" "$C $C $L $E" "$D $D" "$C $C" "$D $D - $E" "$C $C - $E"; echo "deployed sha=$D"; hist "$B" "$C"; } >"$TMP/history-mismatch.state"
rb history-mismatch 1 'is not .deployed'

{ slots "$D $D $L $E" MISSING "$D $D" MISSING "$D $D - $E" MISSING; echo "deployed sha=$D"; hist "$D"; } >"$TMP/no-history.state"
rb no-history 1 'fewer than two entries'

{ slots MISSING MISSING "$D $D" "$C $C" "$D $D - $E" "$C $C - $E"; echo "deployed sha=$D"; hist "$C" "$D"; } >"$TMP/no-be-metadata.state"
rb no-be-metadata 1 'live BE build has no usable metadata'

echo "== $pass passed, $fail failed"
[ "$fail" = 0 ]
