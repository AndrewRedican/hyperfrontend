#!/usr/bin/env node
// Validates matrix/columns/*.json against the attribute catalogue and, on request,
// projects them into the two assembled forms the model documents quote.
//
// Usage: node assemble.mjs [--json <path>] [--tsv <path>]
//
// Validation always runs. Nothing is written unless a path is given, so the
// generated forms never appear in the tree unasked. Exits non-zero on a problem.
//   --json  the full machine-readable matrix (~1.4 MB): every verdict with its
//           condition, claim type, confidence and evidence refs.
//   --tsv   the compact projection quoted as the evidence base across model/ and
//           scenarios/: one letter per cell (y/n/c/-/?), 220 rows x 30 units.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const optionOf = (flag) => {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : null;
};
const jsonOut = optionOf('--json');
const tsvOut = optionOf('--tsv');

const attrs = JSON.parse(readFileSync(join(here, 'attributes.json'), 'utf8'));
const attrIds = attrs.groups.flatMap(g => g.attributes.map(a => a.id));
const attrSet = new Set(attrIds);
const VALUES = new Set(['yes', 'no', 'conditional', 'na', 'unknown']);
const CLAIMS = new Set(['framework-guarantee', 'browser-guarantee', 'common-pattern',
  'possible-extension', 'officially-supported', 'community-convention', 'inference']);
const LETTERS = { yes: 'y', no: 'n', conditional: 'c', na: '-', unknown: '?' };

const colDir = join(here, 'columns');
const files = readdirSync(colDir).filter(f => f.endsWith('.json')).sort();
const problems = [];
const units = [];

for (const f of files) {
  const col = JSON.parse(readFileSync(join(colDir, f), 'utf8'));
  const seen = new Set();
  const p = (msg) => problems.push(`${f}: ${msg}`);
  if (!col.unit || !col.dossier || !col.verifiedAt) p('missing unit/dossier/verifiedAt');
  for (const v of col.verdicts ?? []) {
    if (!attrSet.has(v.id)) p(`unknown attribute id ${v.id}`);
    if (seen.has(v.id)) p(`duplicate verdict ${v.id}`);
    seen.add(v.id);
    if (!VALUES.has(v.value)) p(`bad value "${v.value}" on ${v.id}`);
    if (v.value === 'conditional' && !v.condition) p(`conditional without condition: ${v.id}`);
    if (v.claimType && !CLAIMS.has(v.claimType)) p(`bad claimType "${v.claimType}" on ${v.id}`);
    if (!Array.isArray(v.evidence) || v.evidence.length === 0) p(`no evidence on ${v.id}`);
  }
  const missing = attrIds.filter(id => !seen.has(id));
  if (missing.length) p(`missing ${missing.length} verdicts: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' ...' : ''}`);
  units.push(col);
}

if (problems.length) {
  console.error(`VALIDATION: ${problems.length} problem(s):`);
  for (const p of problems) console.error('  -', p);
} else {
  console.log(`VALIDATION: clean (${units.length} units x ${attrIds.length} attributes)`);
}

if (jsonOut) {
  const matrix = {
    schemaVersion: attrs.schemaVersion,
    researchSnapshot: attrs.researchSnapshot,
    attributeCount: attrIds.length,
    unitCount: units.length,
    attributesRef: 'attributes.json',
    units: units.map(u => ({ unit: u.unit, dossier: u.dossier, verifiedAt: u.verifiedAt, verdicts: u.verdicts })),
  };
  writeFileSync(jsonOut, JSON.stringify(matrix));
  console.log(`Wrote ${jsonOut}`);
}

if (tsvOut) {
  const byUnit = units.map(u => new Map(u.verdicts.map(v => [v.id, v.value])));
  const rows = [['attribute', ...units.map(u => u.unit)].join('\t')];
  for (const id of attrIds) {
    rows.push([id, ...byUnit.map(m => LETTERS[m.get(id)] ?? '?')].join('\t'));
  }
  writeFileSync(tsvOut, rows.join('\n'));
  console.log(`Wrote ${tsvOut}`);
}

process.exit(problems.length ? 1 : 0);
