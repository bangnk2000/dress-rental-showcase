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
