#!/usr/bin/env node
// Cheap reads of feature_list.json so an agent never has to open the whole 100+ KB ledger.
//   node scripts/ledger.mjs check        lint: valid JSON, unique ids, <=1 in-progress, pass has evidence
//   node scripts/ledger.mjs summary [n]  counts, the in-progress entry, the last n entries (default 5)
//   node scripts/ledger.mjs show <id>    one entry as JSON
//   node scripts/ledger.mjs ids          every id with its status, one per line
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../feature_list.json', import.meta.url));
const [cmd = 'summary', arg] = process.argv.slice(2);

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
// docs/spec/init-harness/02-artifacts-and-templates.md §2.2
const STATUSES = ['todo', 'in-progress', 'pass', 'fail', 'blocked'];

if (cmd === 'check') {
  const problems = [];
  const seen = new Set();
  for (const f of features) {
    if (typeof f?.id !== 'string' || !f.id) {
      problems.push('an entry has no string id');
      continue;
    }
    if (seen.has(f.id)) problems.push(`duplicate id ${f.id}`);
    seen.add(f.id);
    if (!STATUSES.includes(f.status)) problems.push(`${f.id}: unknown status ${JSON.stringify(f.status)}`);
    if (f.status === 'pass' && (typeof f.evidence !== 'string' || !f.evidence.trim()))
      problems.push(`${f.id}: pass without string evidence`);
    if (f.dependencies !== undefined && !Array.isArray(f.dependencies)) problems.push(`${f.id}: dependencies is not an array`);
    for (const dep of Array.isArray(f.dependencies) ? f.dependencies : []) if (!features.some((g) => g.id === dep)) problems.push(`${f.id}: unknown dependency ${dep}`);
  }
  const inProgress = features.filter((f) => f.status === 'in-progress');
  if (inProgress.length > 1) problems.push(`${inProgress.length} entries in-progress: ${inProgress.map((f) => f.id).join(', ')}`);
  if (problems.length) {
    for (const p of problems) console.error(`FAIL: ${p}`);
    process.exit(1);
  }
  console.log(`OK: ledger valid — ${features.length} entries, ${inProgress.length} in-progress`);
} else if (cmd === 'summary') {
  const n = Number(arg ?? 5);
  const counts = {};
  for (const f of features) counts[f.status] = (counts[f.status] ?? 0) + 1;
  console.log(`${features.length} entries — ${Object.entries(counts).map(([s, c]) => `${c} ${s}`).join(', ')}`);
  const wip = features.find((f) => f.status === 'in-progress');
  console.log(`in-progress: ${wip ? `${wip.id} — ${wip.title}` : 'none'}`);
  console.log(`last ${n}:`);
  for (const f of features.slice(-n)) console.log(`  ${f.status.padEnd(11)} ${f.testedAt ?? '          '} ${f.id} — ${f.title}`);
} else if (cmd === 'show') {
  const f = features.find((g) => g.id === arg);
  if (!f) {
    console.error(`no entry ${arg}`);
    process.exit(1);
  }
  console.log(JSON.stringify(f, null, 2));
} else if (cmd === 'ids') {
  for (const f of features) console.log(`${f.status}\t${f.id}`);
} else {
  console.error(`unknown command ${cmd} (check | summary [n] | show <id> | ids)`);
  process.exit(2);
}
