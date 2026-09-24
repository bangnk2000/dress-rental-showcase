#!/usr/bin/env bash
# Belt-and-braces boundary checks (docs/spec/init-nextjs/13-harness-engineering.md §5), wired as
# `pnpm --filter web arch`. Survives any ESLint misconfiguration.
set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
report() {
  if [ -z "$2" ]; then echo "PASS: $1"; else echo "VIOLATION: $1"; echo "$2" | sed 's/^/  /'; FAIL=1; fi
}

SRC_TS=(--include='*.ts' --include='*.tsx')

# 1. Generated purity — compares against the COMMITTED client (red between `pnpm contract` and the
#    commit, by design: commit BE + packages/contract + every client together).
if pnpm generate:api >/dev/null 2>&1 && git diff --quiet -- src/api/generated; then
  report "(1) generated client is fresh" ""
else
  report "(1) generated client is fresh" "$(git diff --stat -- src/api/generated 2>/dev/null || true)"
fi
# 2. HTTP door: the mutator is the only fetch site.
HITS=$(grep -rEn "(from ['\"]axios|[^.A-Za-z]fetch\()" src "${SRC_TS[@]}" | grep -v '^src/api/' | grep -v '^src/test/' || true)
report "(2) no fetch()/axios outside src/api/" "$HITS"
# 3. Kernel purity.
HITS=$(grep -rEn "from ['\"]@/features/" src/components src/lib src/hooks src/i18n "${SRC_TS[@]}" 2>/dev/null || true)
report "(3) kernel imports no feature" "$HITS"
# 4. Ring privacy: nothing imports app/; no deep feature imports.
HITS=$(grep -rEn "@/app(/|['\"])" src "${SRC_TS[@]}" | grep -v '^src/app/' || true)
HITS+=$(grep -rEn "@/features/[a-z0-9-]+/" src "${SRC_TS[@]}" || true)
report "(4) nothing imports app/, no deep feature imports" "$HITS"
# 5. Boundary hygiene: no next/headers in client files, no secret-shaped NEXT_PUBLIC_*, Tailwind v4 only.
HITS=""
while IFS= read -r f; do
  if grep -q "next/headers" "$f"; then HITS+="$f"$'\n'; fi
done < <(grep -rlE "^['\"]use client['\"]" src "${SRC_TS[@]}" || true)
HITS+=$(grep -rEn "NEXT_PUBLIC_[A-Z_]*(SECRET|KEY|TOKEN)" src .env.example 2>/dev/null || true)
HITS+=$(ls tailwind.config.* 2>/dev/null || true)
HITS+=$(grep -rn "@tailwind " src 2>/dev/null || true)
report "(5) server/client + Tailwind hygiene" "$HITS"
# 6. Locale parity: every locale's namespace key set equals the schema locale's (vi).
HITS=$(node -e '
  const fs = require("fs"), path = require("path");
  const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, p + k + ".") : [p + k]);
  const load = (l) => Object.fromEntries(fs.readdirSync(path.join("messages", l))
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f, keys(JSON.parse(fs.readFileSync(path.join("messages", l, f), "utf8"))).sort().join(",")]));
  const locales = fs.readdirSync("messages").filter((d) => fs.statSync(path.join("messages", d)).isDirectory());
  const schema = load("vi");
  for (const l of locales) {
    const cur = load(l);
    for (const ns of new Set([...Object.keys(schema), ...Object.keys(cur)]))
      if (schema[ns] !== cur[ns]) console.log(`${l}/${ns} differs from vi/${ns}`);
  }')
report "(6) locale key parity" "$HITS"
# 7. Navigation door: features use @/i18n/navigation.
HITS=$(grep -rEn "from ['\"]next/(link|navigation)['\"]" src/features "${SRC_TS[@]}" 2>/dev/null || true)
report "(7) features navigate through @/i18n/navigation" "$HITS"

[ "$FAIL" -eq 0 ] || exit 1
echo "ARCH: all checks green."
