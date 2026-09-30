// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex diff — what changed since the last compile, in both directions:
 *
 *   1. Hand edits: generated files someone edited (line diff vs. what Cortex wrote).
 *   2. Source changes: files the next `cortex compile` would create, change or remove.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '../utils/fs.js';
import { hashContent } from '../core/manifest.js';
import { requireCortex, inspectProject } from '../core/health.js';
import { heading, info, success, dim, error } from '../utils/log.js';

const NO_COLOR = process.env.NO_COLOR !== undefined;
const paint = (code, s) => (NO_COLOR ? s : `\x1b[${code}m${s}\x1b[0m`);
const MAX_LINES = 40;

export default async function diff({ values }) {
  const projectRoot = findProjectRoot();
  requireCortex(projectRoot);

  let inspection;
  try {
    inspection = inspectProject(projectRoot);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
  const { manifest, outputs } = inspection;

  // 1. Hand edits to generated files
  const edits = [];
  for (const entry of manifest?.files || []) {
    const abs = join(projectRoot, entry.file);
    if (!existsSync(abs)) { edits.push({ file: entry.file, deleted: true, lines: [] }); continue; }
    const current = readFileSync(abs, 'utf-8');
    if (hashContent(current) === entry.hash) continue;
    edits.push({ file: entry.file, deleted: false, lines: lineDiff(entry.compiledContent || '', current) });
  }

  // 2. Source changes since the last compile
  const known = new Map((manifest?.files || []).map(e => [e.file, e]));
  const pending = [];
  for (const o of outputs) {
    const entry = known.get(o.path);
    if (!entry) pending.push({ file: o.path, change: 'new' });
    else if (entry.hash !== hashContent(o.content)) pending.push({ file: o.path, change: 'changed' });
  }
  for (const r of inspection.removals) pending.push({ file: r.file, change: 'removed' });

  if (values.json) {
    console.log(JSON.stringify({ compiledAt: manifest?.compiledAt || null, handEdits: edits, sourceChanges: pending }, null, 2));
    return;
  }

  heading('Changes since last compile');
  if (manifest) dim(`Last compiled: ${manifest.compiledAt}`);
  else dim('Never compiled in this checkout (no .cortex/.compile-manifest.json).');
  console.log();

  if (edits.length) {
    info(`Edited by hand (${edits.length}):`);
    for (const e of edits) {
      console.log(`    ${paint('1', e.file)}${e.deleted ? '  — deleted' : ''}`);
      if (e.deleted) continue;
      const shown = e.lines.slice(0, MAX_LINES);
      for (const l of shown) console.log(`      ${l.op === '+' ? paint('32', `+ ${l.text}`) : paint('31', `- ${l.text}`)}`);
      if (e.lines.length > shown.length) dim(`  … ${e.lines.length - shown.length} more changed line(s)`);
    }
    dim('Keep an edit: add it to .cortex/rules (or run `cortex learn`), then `cortex compile --force`.');
    console.log();
  }

  if (pending.length) {
    info(`Sources changed — \`cortex compile\` would update ${pending.length} file(s):`);
    const label = { new: '+ create', changed: '~ update', removed: '- remove' };
    for (const p of pending) dim(`${label[p.change].padEnd(9)} ${p.file}`);
    console.log();
  }

  if (!edits.length && !pending.length) success('No changes: generated files match .cortex/ and the last compile.');
}

/**
 * Changed lines between two texts (LCS-based), as [{ op: '+'|'-', text }].
 * Falls back to a set difference for very large files.
 */
export function lineDiff(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 4_000_000) {
    const inA = new Set(a);
    const inB = new Set(b);
    return [
      ...a.filter(l => l.trim() && !inB.has(l)).map(text => ({ op: '-', text })),
      ...b.filter(l => l.trim() && !inA.has(l)).map(text => ({ op: '+', text })),
    ];
  }
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ op: '-', text: a[i++] });
    else out.push({ op: '+', text: b[j++] });
  }
  while (i < n) out.push({ op: '-', text: a[i++] });
  while (j < m) out.push({ op: '+', text: b[j++] });
  return out.filter(l => l.text.trim());
}
