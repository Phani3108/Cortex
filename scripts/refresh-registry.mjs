#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Cortex — refresh registry/latest.json from the live OpenRouter catalog.
// Run by .github/workflows/refresh-registry.yml every day; safe to run locally.
//
//   node scripts/refresh-registry.mjs            # write registry/latest.json
//   node scripts/refresh-registry.mjs --check    # exit 1 if data is out of date
//   node scripts/refresh-registry.mjs --input catalog.json   # offline build
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistryFromOpenRouter, OPENROUTER_MODELS_URL } from '../src/core/registry-build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'registry', 'latest.json');
const args = process.argv.slice(2);
const check = args.includes('--check');
const inputIdx = args.indexOf('--input');

async function loadCatalog() {
  if (inputIdx !== -1) return JSON.parse(readFileSync(args[inputIdx + 1], 'utf-8'));
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { 'User-Agent': 'cortex-registry-refresh (+https://github.com/Phani3108/Cortex)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenRouter responded HTTP ${res.status}`);
  return res.json();
}

const readJson = p => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null);

const catalog = await loadCatalog();
const previous = readJson(target);
const overrides = readJson(join(root, 'registry', 'overrides.json')) || {};
const { registry, changes } = buildRegistryFromOpenRouter(catalog, { previous, overrides });

const summary = summarize(changes);
console.log(`Models: ${registry.modelCount} · changes: ${changes.length}${summary ? `\n${summary}` : ''}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Registry refresh\n\n${registry.modelCount} models, ${changes.length} change(s)\n\n${summary || '_No changes._'}\n`);
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changes=${changes.length}\nmodels=${registry.modelCount}\n`);
}

if (check) process.exit(changes.length ? 1 : 0);
// Write when model data changed, or when derived fields (highlights, provider
// lineups) changed shape — but never just to bump a timestamp.
const strip = r => JSON.stringify({ ...r, lastUpdated: null, version: null });
if (!previous || changes.length || strip(previous) !== strip(registry)) {
  writeFileSync(target, JSON.stringify(registry, null, 2) + '\n');
  console.log(`Wrote ${target}`);
}

function summarize(list) {
  const lines = [];
  const pick = type => list.filter(c => c.type === type);
  const fmt = n => (n === null || n === undefined ? '?' : `$${n}`);
  for (const c of pick('added').slice(0, 25)) lines.push(`- added \`${c.model}\` (${fmt(c.input)} / ${fmt(c.output)} per 1M)`);
  for (const c of pick('price_change').slice(0, 25)) lines.push(`- repriced \`${c.model}\` ${fmt(c.from.input)}→${fmt(c.to.input)} in, ${fmt(c.from.output)}→${fmt(c.to.output)} out`);
  for (const c of pick('removed').slice(0, 25)) lines.push(`- removed \`${c.model}\``);
  for (const c of pick('status_change').slice(0, 25)) lines.push(`- \`${c.model}\` ${c.from} → ${c.to}`);
  const extra = list.length - lines.length;
  if (extra > 0) lines.push(`- …and ${extra} more`);
  return lines.join('\n');
}
