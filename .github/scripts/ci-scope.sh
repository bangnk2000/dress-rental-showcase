#!/usr/bin/env bash
#
# Works out which CI jobs this event actually needs.
#
# A push to master always runs everything: master is what we release from, so it
# is never worth guessing there. A pull request runs only the jobs whose inputs
# changed. Anything we cannot work out confidently falls back to running
# everything -- a wasted job costs a minute, a wrongly skipped one ships a bug.
set -euo pipefail

run_all() {
  {
    echo "be=true"
    echo "fe=true"
    echo "qr=true"
    echo "web=true"
    echo "contract=true"
  } >>"${GITHUB_OUTPUT}"
  echo "Running every job: $1"
}

if [ "${GITHUB_EVENT_NAME}" != "pull_request" ]; then
  run_all "event is ${GITHUB_EVENT_NAME}, not a pull request"
  exit 0
fi

# On a pull_request event the checkout is the merge commit, so its first parent
# is the base branch tip and the diff against it is exactly what the PR changes.
# If HEAD is not that merge commit (an unmergeable PR is checked out as the head
# ref instead) we have no trustworthy base, so we run everything.
if [ "$(git rev-list --parents -n 1 HEAD | wc -w)" -ne 3 ]; then
  run_all "HEAD is not the pull request merge commit, so the diff base is unknown"
  exit 0
fi

if ! changed=$(git diff --name-only HEAD^1 HEAD); then
  run_all "could not diff against the base branch"
  exit 0
fi

if [ -z "${changed}" ]; then
  run_all "the diff against the base branch is empty"
  exit 0
fi

echo "Changed files:"
echo "${changed}" | sed 's/^/  /'

changed_matches() {
  echo "${changed}" | grep -Eq "$1"
}

# Toolchain, lockfile and CI config are shared by every workspace, so a change
# to any of them invalidates every job.
if changed_matches '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.github/)'; then
  run_all "a repo-wide file changed"
  exit 0
fi

be=false
fe=false
qr=false
web=false
contract=false

if changed_matches '^apps/be/'; then
  be=true
fi

# fe, qr-admin and web compile against the committed OpenAPI contract, so a contract
# change can break them even when their own sources are untouched. fe also bundles
# packages/image-url (its own tests run in the fe job).
if changed_matches '^(apps/fe/|packages/contract/|packages/image-url/)'; then
  fe=true
fi

if changed_matches '^(apps/qr-admin/|packages/contract/)'; then
  qr=true
fi

if changed_matches '^(apps/web/|packages/contract/)'; then
  web=true
fi

# The contract job carries all three drift gates (docs/spec/init-monorepo-contract
# /03-ci-and-runtime.md §1), and gate 3 -- `pnpm check` -- compiles be and type
# checks every client. Every app is an input to it, so any app change invalidates
# it. In practice only doc-only pull requests skip this job.
if [ "${be}" = true ] || [ "${fe}" = true ] || [ "${qr}" = true ] || [ "${web}" = true ]; then
  contract=true
fi

{
  echo "be=${be}"
  echo "fe=${fe}"
  echo "qr=${qr}"
  echo "web=${web}"
  echo "contract=${contract}"
} >>"${GITHUB_OUTPUT}"

echo "Jobs to run: be=${be} fe=${fe} qr=${qr} web=${web} contract=${contract}"
