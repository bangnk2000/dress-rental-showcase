#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
report() {
  if [ -z "$2" ]; then echo "PASS: $1"; else echo "VIOLATION: $1"; echo "$2" | sed 's/^/  /'; FAIL=1; fi
}

SRC_TS=(--include='*.ts' --include='*.tsx')
HITS=$(grep -rEn "from ['\"]axios" src "${SRC_TS[@]}" | grep -v '^src/api/' || true)
report "(a) no axios imports outside src/api/" "$HITS"
HITS=$(grep -rEn "[^.A-Za-z]fetch\(" src "${SRC_TS[@]}" | grep -v '^src/api/' | grep -v '^src/test/' || true)
report "(b) no bare fetch() outside src/api/" "$HITS"
HITS=$(grep -rEn "@/features/[a-z0-9-]+/" src "${SRC_TS[@]}" || true)
report "(c) no deep feature imports" "$HITS"
HITS=$(grep -rEn "@/app(/|['\"])" src "${SRC_TS[@]}" | grep -v '^src/app/' || true)
report "(d) nothing imports app/ from outside src/app" "$HITS"
HITS=$(grep -rEn "localStorage\.(set|get|remove)Item" src "${SRC_TS[@]}" | grep -v '^src/api/mutator/auth-tokens.ts' || true)
report "(e) localStorage only in api token module" "$HITS"
if pnpm generate:api >/dev/null 2>&1 && git diff --quiet -- src/api/generated; then
  report "(f) generated client is fresh" ""
else
  report "(f) generated client is fresh" "$(git diff --stat -- src/api/generated 2>/dev/null || true)"
fi
[ "$FAIL" -eq 0 ] || exit 1
echo "ARCH: all checks green."
