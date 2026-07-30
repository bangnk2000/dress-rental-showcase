#!/usr/bin/env bash
# apps/fe architecture guardrails — belt-and-braces greps that survive any
# ESLint misconfiguration (docs/spec/init-react/08-ai-agent-first.md §3c,
# 13-harness-engineering.md §5). Wired as `pnpm --filter fe arch`.
# Exit 1 on any violation; each check prints PASS or VIOLATION.
set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0

report() {
  # $1 = check name, $2 = offending lines ("" = clean)
  if [ -z "$2" ]; then
    echo "PASS: $1"
  else
    echo "VIOLATION: $1"
    echo "$2" | sed 's/^/  /'
    FAIL=1
  fi
}

SRC_TS=(--include='*.ts' --include='*.tsx')

# ── (a) HTTP door: axios/fetch only inside src/api/ ─────────────────────────
HITS=$(grep -rEn "from ['\"]axios" src "${SRC_TS[@]}" | grep -v '^src/api/' || true)
report "(a1) no axios imports outside src/api/" "$HITS"

HITS=$(grep -rEn "[^.A-Za-z]fetch\(" src "${SRC_TS[@]}" | grep -v '^src/api/' | grep -v '^src/test/' || true)
report "(a2) no bare fetch() outside src/api/ (tests exempt)" "$HITS"

# ── (b) feature isolation ────────────────────────────────────────────────────
# b1: deep feature imports (static or dynamic) — only @/features/<name> (index) is public
HITS=$(grep -rEn "@/features/[a-z0-9-]+/" src "${SRC_TS[@]}" || true)
report "(b1) no deep feature imports (@/features/<name>/... beyond index)" "$HITS"

# b2: cross-feature imports — inside features/<x>, no reference to another feature
HITS=""
for dir in src/features/*/; do
  name=$(basename "$dir")
  CROSS=$(grep -rEn "@/features/" "$dir" "${SRC_TS[@]}" | grep -vE "@/features/${name}(['\"/]|$)" || true)
  [ -n "$CROSS" ] && HITS="${HITS}${CROSS}"$'\n'
done
report "(b2) no cross-feature imports" "$(echo -n "$HITS")"

# b3: kernel purity — kernel rings never import features
KERNEL_DIRS=()
for d in src/components src/lib src/hooks src/stores src/types; do
  [ -d "$d" ] && KERNEL_DIRS+=("$d")
done
HITS=$(grep -rEn "@/features/" "${KERNEL_DIRS[@]}" "${SRC_TS[@]}" || true)
report "(b3) kernel (components/lib/hooks/stores/types) imports no features" "$HITS"

# ── (c) app privacy: nothing outside src/app imports @/app ──────────────────
HITS=$(grep -rEn "@/app(/|['\"])" src "${SRC_TS[@]}" | grep -v '^src/app/' || true)
report "(c) nothing imports @/app/ from outside src/app" "$HITS"

# ── (d) generated-code freshness: regenerate == committed state ─────────────
# (Real teeth once src/api/generated is committed; untracked files diff clean.)
if pnpm generate:api >/dev/null 2>&1 && git diff --quiet -- src/api/generated; then
  report "(d) src/api/generated is fresh (orval output matches contract)" ""
else
  report "(d) src/api/generated is fresh (orval output matches contract)" \
    "$(git diff --stat -- src/api/generated 2>/dev/null || echo 'pnpm generate:api failed')"
fi

# ── (e) i18n locale key parity vi ↔ en per namespace ─────────────────────────
if PARITY=$(node <<'NODE'
const fs = require('fs');
const path = require('path');
const dirFor = (lng) => path.join('public', 'locales', lng);
const keysOf = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keysOf(v, prefix + k + '.') : [prefix + k]);
const files = (lng) =>
  fs.readdirSync(dirFor(lng)).filter((f) => f.endsWith('.json')).sort();
const vi = files('vi');
const en = files('en');
let bad = false;
if (vi.join(',') !== en.join(',')) {
  console.log('namespace file sets differ: vi=[' + vi + '] en=[' + en + ']');
  bad = true;
}
for (const f of vi) {
  if (!en.includes(f)) continue;
  const read = (lng) =>
    keysOf(JSON.parse(fs.readFileSync(path.join(dirFor(lng), f), 'utf8'))).sort();
  const kVi = read('vi');
  const kEn = read('en');
  const missingEn = kVi.filter((k) => !kEn.includes(k));
  const missingVi = kEn.filter((k) => !kVi.includes(k));
  if (missingEn.length) { console.log(f + ' missing in en: ' + missingEn.join(', ')); bad = true; }
  if (missingVi.length) { console.log(f + ' missing in vi: ' + missingVi.join(', ')); bad = true; }
}
process.exit(bad ? 1 : 0);
NODE
); then
  report "(e) locale key parity vi <-> en per namespace" ""
else
  report "(e) locale key parity vi <-> en per namespace" "$PARITY"
fi

# ── (f) stack hygiene (tailwind v4 idioms + token storage door) ──────────────
HITS=$(ls tailwind.config.js tailwind.config.ts tailwind.config.cjs 2>/dev/null || true)
report "(f1) no tailwind.config.* (v4 is CSS-first)" "$HITS"

HITS=$(grep -rn "@tailwind " src --include='*.css' || true)
report "(f2) no v3 @tailwind directives" "$HITS"

HITS=$(grep -rEn "localStorage\.(set|get|remove)Item" src "${SRC_TS[@]}" | grep -v '^src/api/mutator/auth-tokens.ts' || true)
report "(f3) localStorage only in src/api/mutator/auth-tokens.ts" "$HITS"

if [ "$FAIL" -ne 0 ]; then
  echo "ARCH: violations found."
  exit 1
fi
echo "ARCH: all checks green."
