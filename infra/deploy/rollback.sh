#!/usr/bin/env bash
# Fast rollback (docs/design/deploy-versioning.md §3.4): puts the previous build of each part back
# (apps/{be/dist,fe/dist,web/run}.prev) and restarts pm2 — no install, no build, no migration.
# EVERYTHING is decided before the VPS is touched; one refused part refuses the whole rollback and
# prints the rebuild fallback instead.
#   in : DRY_RUN=1 → decide and print only;  STATE_FILE=<file> → read the VPS state from a file
#        instead of ssh (tests: infra/deploy/test/rollback.test.sh)
#   out: swapped (true/false), sha, version, parts → $GITHUB_OUTPUT
# Target T: if a live slot is AHEAD of .deployed (a deploy failed after swapping it), T = .deployed;
# otherwise T = the history line before the last one. Rolling back twice = forward again (A3).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${DRY_RUN:=0}"
cd "$REPO_ROOT"
OUT="${GITHUB_OUTPUT:-/dev/null}"
START=$(date +%s)
PARTS_ALL=(be fe web)

refuse() {
  echo "::error::rollback refused — $1"
  [ -z "${2:-}" ] || echo "Fallback (rebuilds, API down 1–2 min): Actions → deploy, ref=$2, only=all."
  echo "swapped=false" >>"$OUT"
  exit 1
}

read_state() {
  if [ -n "${STATE_FILE:-}" ]; then cat "$STATE_FILE"; return; fi
  rssh "D=$REMOTE_DIR O=$OPS_DIR bash -s" <<'EOF'
cd "$D"
for s in be:apps/be/dist/.built be.prev:apps/be/dist.prev/.built fe:apps/fe/dist/version.json \
         fe.prev:apps/fe/dist.prev/version.json web:apps/web/run/.built web.prev:apps/web/run.prev/.built; do
  k=${s%%:*} f=${s#*:}
  if [ -f "$f" ]; then printf '%s %s\n' "$k" "$(head -1 "$f")"; else echo "$k MISSING"; fi
done
# The live env files a swap would run under (a rollback never rewrites them).
for s in be.env:apps/be/.env web.env:$O/dress-web.config.cjs; do
  k=${s%%:*} f=${s#*:}
  if [ -f "$f" ]; then echo "$k $(sha256sum "$f" | cut -c1-64)"; else echo "$k MISSING"; fi
done
[ ! -f .deployed ] || echo "deployed $(head -1 .deployed)"
[ ! -f .deploy-history ] || tail -n 50 .deploy-history | sed 's/^/history /'
EOF
}

STATE=$(read_state) || refuse "cannot read the VPS state over ssh"
echo "== VPS state"; sed 's/^/  /' <<<"$STATE"
slot() { sed -n "s/^$1 //p" <<<"$STATE" | head -1; }   # "be" never matches "be.prev ..."
field() { meta_get "$(slot "$1")" "$2"; }

DEPLOYED=$(meta_get "$(slot deployed)" sha)
has_commit "$DEPLOYED" || refuse ".deployed is missing or names a commit this checkout does not know (${DEPLOYED:-none})"
mapfile -t HIST < <(sed -n 's/^history //p' <<<"$STATE")

# ── Target ───────────────────────────────────────────────────────────────────────────────────────
ahead=()
for p in "${PARTS_ALL[@]}"; do
  cur=$(field "$p" sha)
  if has_commit "$cur" && part_changed "$p" "$DEPLOYED" "$cur"; then ahead+=("$p"); fi
done
if [ ${#ahead[@]} -gt 0 ]; then
  T=$DEPLOYED
  T_VERSION=$(meta_get "$(slot deployed)" version)
  echo "target: .deployed ${T:0:7} ${T_VERSION:-unversioned} — live slot(s) ahead of it: ${ahead[*]} (a deploy failed after swapping them)"
else
  [ ${#HIST[@]} -ge 2 ] || refuse "the deploy history has fewer than two entries — nothing to go back to yet"
  last=${HIST[-1]} before=${HIST[-2]}
  [ "$(meta_get "$last" sha)" = "$DEPLOYED" ] \
    || refuse "the last history line ($(meta_get "$last" sha | cut -c1-7)) is not .deployed (${DEPLOYED:0:7}) — state was changed outside the workflows"
  T=$(meta_get "$before" sha)
  T_VERSION=$(meta_get "$before" version)
  echo "target: ${T:0:7} ${T_VERSION:-unversioned} — the deploy before the current ${DEPLOYED:0:7} $(meta_get "$last" version)"
fi
T_VERSION=${T_VERSION:-unversioned}
has_commit "$T" || refuse "target ${T:-none} is not a commit this checkout knows"

# ── Migrations: against what the live BE actually migrated, not .deployed ──────────────────────
BE_CUR=$(field be sha)
has_commit "$BE_CUR" || refuse "the live BE build has no usable metadata (sha=${BE_CUR:-none}) — cannot prove the migration range" "$T"
if [ -n "$(git diff --name-only "$T" "$BE_CUR" -- apps/be/migrations/)" ]; then
  refuse "migrations differ between the target ${T:0:7} and the live BE ${BE_CUR:0:7} — a rollback across a migration is manual (RUNBOOK)"
fi

# ── Per part: keep, swap, or refuse ─────────────────────────────────────────────────────────────
# A swapped-in build runs under the LIVE env file, so it must be the one that build was deployed with:
# compare what the deploy scripts produced (env=sha256 in the build's metadata vs the live file),
# never the scripts themselves — a script edit that writes the same file must not block a rollback.
env_same() {
  local want got
  want=$(field "$1.prev" env) got=$(slot "$1.env")
  [ -n "$want" ] && [ "$want" = "$got" ]
}
swap_blocker() {  # why the previous slot of part $1 cannot be swapped in; empty when it can
  case "$1" in
    be)
      [ -n "$(field be lock)" ] && [ "$(field be lock)" = "$(field be.prev lock)" ] \
        || { echo "pnpm-lock.yaml differs between the two BE builds (node_modules fit only the live one)"; return; }
      env_same be || echo "apps/be/.env is not the one the previous BE build ran with (env=$(field be.prev env | cut -c1-12) live=$(slot be.env | cut -c1-12))" ;;
    web)
      env_same web || echo "the dress-web pm2 config is not the one the previous bundle ran with (env=$(field web.prev env | cut -c1-12) live=$(slot web.env | cut -c1-12))" ;;
  esac
}
declare -A ACTION WHY
for p in "${PARTS_ALL[@]}"; do
  cur=$(field "$p" sha) prev=$(field "$p.prev" sha)
  cur_ok=false prev_ok=false
  if has_commit "$cur" && ! part_changed "$p" "$cur" "$T"; then cur_ok=true; fi
  if has_commit "$prev" && ! part_changed "$p" "$prev" "$T"; then prev_ok=true; fi
  # fe prefers its previous slot (A5 rebuilt it at T, so its label says T); be/web avoid a restart.
  if [ "$p" = fe ]; then order=(prev cur); else order=(cur prev); fi
  ACTION[$p]=refuse WHY[$p]="neither the live (${cur:0:7}) nor the previous (${prev:0:7}) build is equivalent to ${T:0:7}"
  for o in "${order[@]}"; do
    if [ "$o" = cur ] && $cur_ok; then ACTION[$p]=keep WHY[$p]="live build ${cur:0:7} already equivalent to ${T:0:7}"; break; fi
    if [ "$o" = prev ] && $prev_ok; then
      b=$(swap_blocker "$p")
      if [ -z "$b" ]; then ACTION[$p]=swap WHY[$p]="previous build ${prev:0:7} $(field "$p.prev" version) equivalent to ${T:0:7}"; break; fi
      WHY[$p]=$b
    fi
  done
done

echo "== plan (target ${T:0:7} $T_VERSION)"
refused=() swaps=()
for p in "${PARTS_ALL[@]}"; do
  printf '  %-4s %-6s %s\n' "$p" "${ACTION[$p]}" "${WHY[$p]}"
  [ "${ACTION[$p]}" != refuse ] || refused+=("$p")
  [ "${ACTION[$p]}" != swap ] || swaps+=("$p")
done
[ ${#refused[@]} -eq 0 ] || refuse "cannot swap back: ${refused[*]} (see the plan above)" "$T"
if [ ${#swaps[@]} -eq 0 ]; then
  echo "nothing to swap — production is already equivalent to ${T:0:7}"
  echo "swapped=false" >>"$OUT"; exit 0
fi
if [ "$DRY_RUN" = 1 ]; then
  echo "DRY_RUN=1 — would swap: ${swaps[*]}"
  echo "swapped=false" >>"$OUT"; exit 0
fi

# ── Swap (BE first: its restart is the only API gap) ────────────────────────────────────────────
has() { [[ " ${swaps[*]} " == *" $1 "* ]]; }
SW_BE=false SW_FE=false SW_WEB=false
has be && SW_BE=true; has fe && SW_FE=true; has web && SW_WEB=true
rssh "D=$REMOTE_DIR SW_BE=$SW_BE SW_FE=$SW_FE SW_WEB=$SW_WEB bash -s" <<'EOF'
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:$PATH
cd "$D"
swap() { rm -rf "$1.rb" && mv "$1" "$1.rb" && mv "$1.prev" "$1" && mv "$1.rb" "$1.prev" && echo "swapped $1 <-> $1.prev"; }
# pm2 restarts WITHOUT --update-env: keep the env the processes were started with.
if [ "$SW_BE" = true ]; then swap apps/be/dist; pm2 restart dress-api >/dev/null; echo "dress-api restarted"; fi
if [ "$SW_FE" = true ]; then swap apps/fe/dist; fi
if [ "$SW_WEB" = true ]; then swap apps/web/run; pm2 restart dress-web >/dev/null; echo "dress-web restarted"; fi
EOF
echo "swapped ${swaps[*]} in $(( $(date +%s) - START ))s — verify next"
{
  echo "swapped=true"; echo "sha=$T"; echo "version=$T_VERSION"
  echo "parts=$(IFS=,; echo "${swaps[*]}")"
} >>"$OUT"
