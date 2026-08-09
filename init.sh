#!/usr/bin/env bash
# Root harness resume-verification (docs/spec/init-monorepo-contract/04-harness-binding.md).
# Degrades gracefully while apps are not yet bootstrapped: skeleton checks only, exit 0 with WARN.
set -euo pipefail
cd "$(dirname "$0")"

echo "== dress-rental init: resume verification =="

command -v pnpm >/dev/null 2>&1 || { echo "FAIL: pnpm not installed"; exit 1; }
node -e 'const [maj,min]=process.versions.node.split(".").map(Number); process.exit(maj>22||(maj===22&&min>=18)?0:1)' \
  || { echo "FAIL: Node >= 22.18 required (Orval 8 floor), found $(node -v)"; exit 1; }

HAS_BE=0; HAS_FE=0; HAS_QR_ADMIN=0
[ -f apps/be/package.json ] && HAS_BE=1
[ -f apps/fe/package.json ] && HAS_FE=1
[ -f apps/qr-admin/package.json ] && HAS_QR_ADMIN=1

if [ "$HAS_BE" = 0 ] && [ "$HAS_FE" = 0 ] && [ "$HAS_QR_ADMIN" = 0 ]; then
  echo "WARN: no apps bootstrapped yet — next step is the BE kickoff prompt"
  echo "      (docs/spec/init-nestjs-hexagonal/README.md §Kickoff)."
  echo "OK: skeleton checks passed."
  exit 0
fi

pnpm install --frozen-lockfile

# 1. Contract freshness FIRST — every later gate trusts the generated layer.
if [ "$HAS_BE" = 1 ]; then
  pnpm openapi:emit
  git diff --exit-code packages/contract
fi
if [ "$HAS_FE" = 1 ] || [ "$HAS_QR_ADMIN" = 1 ]; then
  pnpm generate:api
  git diff --exit-code apps/fe/src/api/generated apps/qr-admin/src/api/generated
fi

# 2. Cross-side types.
[ "$HAS_BE" = 1 ] && pnpm --filter be build
[ "$HAS_FE" = 1 ] && pnpm --filter fe check
[ "$HAS_QR_ADMIN" = 1 ] && pnpm --filter qr-admin check

# 3. Per-app quality gates.
pnpm lint
pnpm arch
pnpm test

# 4. Runtime-adjacent gates (degrade with WARN when infra is absent).
# `pnpm --filter be test:e2e` = the invariant-proof suite: it builds the api, creates/migrates
# <db>_test and provokes the real EXCLUDE/UNIQUE/CHECK constraints (apps/be/test/). Playwright
# (`pnpm --filter fe e2e`) stays OUT of this script on purpose: it needs installed browsers plus a
# running BE + Vite (apps/fe/AGENTS.md #5).
if [ "$HAS_BE" = 1 ]; then
  if docker compose ps db >/dev/null 2>&1 && [ -n "$(docker compose ps -q db)" ]; then
    pnpm --filter be test:e2e || { echo "FAIL: BE invariant-proof e2e"; exit 1; }
  else
    echo "WARN: postgres not running (docker compose up -d) — BE invariant-proof e2e skipped."
  fi
fi
[ "$HAS_FE" = 1 ] && pnpm --filter fe build
[ "$HAS_QR_ADMIN" = 1 ] && pnpm --filter qr-admin build

[ "$HAS_BE" = 0 ] && echo "WARN: apps/be not bootstrapped (docs/spec/init-nestjs-hexagonal/README.md)."
[ "$HAS_FE" = 0 ] && echo "WARN: apps/fe not bootstrapped (docs/spec/init-react/README.md)."
[ "$HAS_QR_ADMIN" = 0 ] && echo "WARN: apps/qr-admin not bootstrapped (docs/design/qr-admin.md)."
echo "== init: all runnable gates green =="
