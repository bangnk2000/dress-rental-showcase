# Ledger Tool — `scripts/ledger.mjs` (reference implementation)

The ledger ([02 §2.2](./02-artifacts-and-templates.md)) grows past what an agent should read
whole: the first donor repo hit 120 KB / 50 entries, and every session that opened it to find
"what is in progress" paid that cost. This file ships the **reader + linter** that donor repo
converged on, generalized. Copy the block below to `scripts/ledger.mjs` in the target repo —
this set stays markdown-only on purpose, so the code lives here as a fenced block, not as a
loose script a vendoring copy could pick up as tooling.

## 8.1 What it gives each reader

| Reader | Command | Replaces |
| --- | --- | --- |
| Agent, every resume | `summary` — counts, the in-progress entry, what waits on a human, last n | opening `feature_list.json` |
| Agent, one feature | `show <id>` | scrolling the file |
| CI + `init.sh` (first line) | `check` — the lint below; exit 1 on any problem | "cheap CI lint" left unspecified |
| **Human reviewer** | `pending` — owner decisions not yet made + passed features not yet deployed, with deploy order | reading handoff prose to find what needs you ([07](./07-human-control.md)) |
| Doc maintainer | `stale-status <md…>` — doc table rows that restate a ledger status and disagree with it | noticing by luck that the SRS says `not-started` for shipped work |

## 8.2 The lint — legacy-safe by construction

Always checked (every entry): valid JSON, unique ids, status in vocabulary, at most one
`in-progress`, `pass`/`fail` carry evidence, a `title` (or legacy `name`), dependencies exist,
and the SHAPE of `ownerPending` / `deploy` when present.

Checked only on **strict** entries — those carrying `tier` (02 §2.2 schema v2):

- `id` matches the binding's `ID_PATTERN` (fill it from the `UNIT_OF_WORK` slot, 05 §5.1);
- `description` non-empty (behavior + done criteria + requirement id);
- `pass` has `testedAt`;
- `tier: "design"` and status `in-progress`/`pass` → `designDoc` exists and its header is not
  `draft`; if the header says `agent-default`, `ownerPending` must be non-empty
  ([07 §7.3](./07-human-control.md)).

Entries written before `tier` existed are never failed for fields they predate. **Do not
backfill** `tier`/ACs/descriptions onto old entries to "pass" the strict lint — that invents
history (02 §2.2). New entries opt in by carrying `tier`.

Proof run before this file was published (2026-10-30), on a **scratch copy** of the first
donor's ledger + docs (the donor repo itself was not modified):

- legacy: its 50-entry ledger → `check` OK (0 strict entries) — adopting the tool fails nothing;
- `ID_PATTERN` default over its 50 real ids → 48 match; the 2 that do not are exactly the
  `catalog:…` ids that drifted from its own convention (legacy, so reported by pattern, not failed);
- 11 synthetic entries appended: 7 meant-to-fail each produced their FAIL line (bad id, design
  entry without `designDoc`, `draft` doc on a pass, a "draft — not yet approved" Status line,
  `agent-default` doc with empty `ownerPending`, colon-separated context id, malformed
  `ownerPending`/`deploy`); 4 controls passed (draft doc on a `todo`, `agent-default` doc WITH
  `ownerPending`, approved doc, `be:` single-side id);
- `pending` listed the one open owner decision and the one undeployed pass with its order;
- `stale-status` over its SRS found the two real stale rows (`not-started` for shipped work).

## 8.3 The script

```js
#!/usr/bin/env node
// Cheap reads + lint of feature_list.json so an agent never opens the whole ledger.
// Source: knowledge-system prompts/init-harness/08-ledger-tool.md (copy, then fill ID_PATTERN).
//   node scripts/ledger.mjs check              lint (CI runs this; init.sh runs it first)
//   node scripts/ledger.mjs summary [n]        counts, in-progress, owner-pending, last n entries
//   node scripts/ledger.mjs pending            what waits on a HUMAN: owner decisions + undeployed passes
//   node scripts/ledger.mjs show <id>          one entry as JSON
//   node scripts/ledger.mjs ids                every id with its status
//   node scripts/ledger.mjs stale-status <md…> table rows in docs that restate a ledger status wrongly
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// {{ID_PATTERN}} — from the stack binding's UNIT_OF_WORK slot. Enforced on strict entries only.
// Default: `<context>/<use-case>` (incl. `infra/<name>`) or single-side `be:|fe:|web:<slug>`.
const ID_PATTERN = /^((infra|[a-z][a-z0-9-]*)\/[a-z0-9][a-z0-9-]*|(be|fe|web):[a-z0-9][a-z0-9-]*)$/;
const STATUSES = ['todo', 'in-progress', 'pass', 'fail', 'blocked'];
const TIERS = ['mechanical', 'standard', 'design'];
const DATE = /^\d{4}-\d{2}-\d{2}/;

const file = fileURLToPath(new URL('../feature_list.json', import.meta.url));
const root = dirname(file);
const [cmd = 'summary', ...args] = process.argv.slice(2);

let ledger;
try {
  ledger = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`FAIL: feature_list.json is not valid JSON — ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(ledger?.features) || ledger.features.length === 0) {
  console.error('FAIL: feature_list.json has no non-empty "features" array');
  process.exit(1);
}
const features = ledger.features;
const titleOf = (f) => f.title ?? f.name ?? '';
const pendingOf = (f) => (Array.isArray(f.ownerPending) ? f.ownerPending.filter((o) => typeof o?.item === 'string') : []);
const undeployed = (f) => f.status === 'pass' && f.deploy && !f.deploy.deployed;

// Design doc approval, read from its header table/line: draft | agent-default | approved | as-built.
function designState(path) {
  const abs = resolve(root, path);
  if (!existsSync(abs)) return 'missing';
  const head = readFileSync(abs, 'utf8').split('\n').slice(0, 30).join('\n');
  const line = head.split('\n').find((l) => /status/i.test(l)) ?? '';
  // The FIRST state word on the Status line decides ("draft — not yet approved" is a draft).
  const first = (line.match(/\b(draft|agent-default|approved|as-built|implemented)\b/i)?.[1] ?? 'draft').toLowerCase();
  if (first === 'draft') return 'draft';
  if (first === 'agent-default' || /agent-default/i.test(head)) return 'agent-default';
  return 'approved';
}

function lint(f, problems) {
  const p = (msg) => problems.push(`${f.id}: ${msg}`);
  if (!STATUSES.includes(f.status)) p(`unknown status ${JSON.stringify(f.status)}`);
  if (!titleOf(f)) p('no title');
  if ((f.status === 'pass' || f.status === 'fail') && (typeof f.evidence !== 'string' || !f.evidence.trim()))
    p(`${f.status} without string evidence`);
  if (f.dependencies !== undefined && !Array.isArray(f.dependencies)) p('dependencies is not an array');
  for (const dep of Array.isArray(f.dependencies) ? f.dependencies : [])
    if (!features.some((g) => g.id === dep)) p(`unknown dependency ${dep}`);
  if (f.ownerPending !== undefined) {
    if (!Array.isArray(f.ownerPending)) p('ownerPending is not an array');
    else for (const o of f.ownerPending)
      if (typeof o?.item !== 'string' || !DATE.test(o?.since ?? '')) p('ownerPending item needs { item, since: YYYY-MM-DD }');
  }
  if (f.deploy !== undefined) {
    const d = f.deploy;
    if (typeof d !== 'object' || !Array.isArray(d.order) || typeof d.migration !== 'boolean')
      p('deploy needs { order: string[], migration: boolean, deployed?: "<sha> YYYY-MM-DD" }');
  }
  // Strict schema is OPT-IN per entry: an entry carrying `tier` was written under these rules.
  // Legacy entries (no tier) are never failed for fields they predate — do not backfill them.
  if (f.tier === undefined) return;
  if (!TIERS.includes(f.tier)) p(`unknown tier ${JSON.stringify(f.tier)}`);
  if (!ID_PATTERN.test(f.id)) p(`id does not match ${ID_PATTERN}`);
  if (typeof f.description !== 'string' || !f.description.trim()) p('no description (behavior + done criteria + requirement id)');
  if (f.status === 'pass' && !DATE.test(f.testedAt ?? '')) p('pass without testedAt');
  if (f.tier === 'design' && ['in-progress', 'pass'].includes(f.status)) {
    if (typeof f.designDoc !== 'string') p('design-tier entry has no designDoc');
    else {
      const s = designState(f.designDoc);
      if (s === 'missing') p(`designDoc ${f.designDoc} not found`);
      else if (s === 'draft') p(`designDoc ${f.designDoc} is not approved — design gate`);
      else if (s === 'agent-default' && pendingOf(f).length === 0)
        p(`designDoc ${f.designDoc} runs on agent defaults but ownerPending is empty`);
    }
  }
}

if (cmd === 'check') {
  const problems = [];
  const seen = new Set();
  for (const f of features) {
    if (typeof f?.id !== 'string' || !f.id) { problems.push('an entry has no string id'); continue; }
    if (seen.has(f.id)) problems.push(`duplicate id ${f.id}`);
    seen.add(f.id);
    lint(f, problems);
  }
  const wip = features.filter((f) => f.status === 'in-progress');
  if (wip.length > 1) problems.push(`${wip.length} entries in-progress: ${wip.map((f) => f.id).join(', ')}`);
  if (problems.length) {
    for (const p of problems) console.error(`FAIL: ${p}`);
    process.exit(1);
  }
  const strict = features.filter((f) => f.tier !== undefined).length;
  console.log(`OK: ledger valid — ${features.length} entries (${strict} strict), ${wip.length} in-progress`);
} else if (cmd === 'summary' || cmd === 'pending') {
  const pend = features.flatMap((f) => pendingOf(f).map((o) => `  ${o.since}  ${f.id} — ${o.item}`));
  const undep = features.filter(undeployed).map((f) => `  ${f.id} — order: ${f.deploy.order.join(' → ')}${f.deploy.migration ? ' (MIGRATION)' : ''}`);
  if (cmd === 'summary') {
    const counts = {};
    for (const f of features) counts[f.status] = (counts[f.status] ?? 0) + 1;
    console.log(`${features.length} entries — ${Object.entries(counts).map(([s, c]) => `${c} ${s}`).join(', ')}`);
    const wip = features.find((f) => f.status === 'in-progress');
    console.log(`in-progress: ${wip ? `${wip.id} — ${titleOf(wip)}` : 'none'}`);
    console.log(`waiting on a human: ${pend.length} owner decision(s), ${undep.length} undeployed pass(es) — \`pending\` lists them`);
    const n = Number(args[0] ?? 5);
    console.log(`last ${n}:`);
    for (const f of features.slice(-n)) console.log(`  ${f.status.padEnd(11)} ${(f.testedAt ?? '').slice(0, 10).padEnd(10)} ${f.id} — ${titleOf(f)}`);
  } else {
    console.log(`owner decisions (${pend.length}):`);
    console.log(pend.length ? pend.join('\n') : '  none');
    console.log(`passed, not deployed (${undep.length}):`);
    console.log(undep.length ? undep.join('\n') : '  none');
  }
} else if (cmd === 'show') {
  const f = features.find((g) => g.id === args[0]);
  if (!f) { console.error(`no entry ${args[0]}`); process.exit(1); }
  console.log(JSON.stringify(f, null, 2));
} else if (cmd === 'ids') {
  for (const f of features) console.log(`${f.status.padEnd(11)} ${f.id}`);
} else if (cmd === 'stale-status') {
  // A doc table row naming a ledger id in backticks AND a status word is a second copy of state.
  const WORDS = /\b(todo|in-progress|pass|fail|blocked|not-started|done)\b/i;
  const norm = (w) => ({ 'not-started': 'todo', done: 'pass' })[w.toLowerCase()] ?? w.toLowerCase();
  const byId = new Map(features.map((f) => [f.id, f]));
  let bad = 0;
  for (const md of args) {
    readFileSync(md, 'utf8').split('\n').forEach((line, i) => {
      if (!line.trimStart().startsWith('|')) return;
      const cells = line.split('|').map((c) => c.trim());
      const status = cells.map((c) => c.match(new RegExp(`^${WORDS.source}$`, 'i'))).find(Boolean);
      if (!status) return;
      for (const [, id] of line.matchAll(/`([^`]+)`/g)) {
        const f = byId.get(id);
        if (f && norm(status[1]) !== f.status) {
          bad++;
          console.error(`STALE: ${md}:${i + 1} says ${id} = ${status[1]}, ledger says ${f.status}`);
        }
      }
    });
  }
  if (bad) process.exit(1);
  console.log(`OK: no stale ledger statuses in ${args.length} file(s)`);
} else {
  console.error(`unknown command ${cmd} — use check | summary [n] | pending | show <id> | ids | stale-status <md…>`);
  process.exit(1);
}
```

Adaptation points: `ID_PATTERN` (binding), `TIERS` if the binding renames tiers, and
`designState()` if the repo's design-doc header uses other words than
`draft | agent-default | approved | as-built` (07 §7.3 defines those four).

## 8.4 Repos without Node

The set is stack-agnostic (README Design Goal 1); Node is only this reference
implementation's runtime. In a repo without Node, port the same checks to the repo's own
scripting language, or run the core subset with `jq` — and say in `AGENTS.md` which you chose:

```bash
jq -e '
  (.features | map(.id) | length == (unique | length))                                   # unique ids
  and ([.features[] | select(.status == "in-progress")] | length <= 1)                  # one in-progress
  and all(.features[]; .status | IN("todo","in-progress","pass","fail","blocked"))      # vocabulary
  and all(.features[] | select(.status == "pass" or .status == "fail"); (.evidence // "") != "")
' feature_list.json >/dev/null || { echo "FAIL: ledger lint"; exit 1; }
```

The `jq` subset omits the strict-entry, design-gate and `pending` checks; a repo that relies on
the design gate or the owner queue should port the full script. **Unverified:** unlike the
script, this snippet was not executed when the file was published (no `jq` on the authoring
machine) — on adoption, run it once against the real ledger and once with a deliberately bad
entry before trusting it.
