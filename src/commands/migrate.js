// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex migrate — compare two AI coding tools and list the exact steps to
 * move a project from one to the other.
 *
 *   cortex migrate copilot cursor
 */

import { findProjectRoot } from '../utils/fs.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';
import { compareProviders } from '../core/compare.js';
import { hasCortex } from '../core/health.js';
import { loadConfig } from '../core/config.js';
import { TARGETS, resolveTargetId, normalizeTargets } from '../engine/index.js';

export default async function migrate({ positionals, values }) {
  const [fromArg, toArg] = positionals;
  if (!fromArg || !toArg) {
    error('Usage: cortex migrate <from-tool> <to-tool>');
    dim('Example: cortex migrate copilot cursor');
    console.log();
    for (const t of Object.values(TARGETS)) dim(`${t.id.padEnd(14)} ${t.name}`);
    process.exit(1);
  }
  const fromId = resolveTargetId(fromArg);
  const toId = resolveTargetId(toArg);
  for (const [arg, id] of [[fromArg, fromId], [toArg, toId]]) {
    if (!id) {
      error(`Unknown tool '${arg}'. Known: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }
  }
  if (fromId === toId) {
    error(`'${fromArg}' and '${toArg}' are the same tool.`);
    process.exit(1);
  }

  let enabled = [];
  const projectRoot = findProjectRoot();
  if (hasCortex(projectRoot)) {
    try {
      const { targets } = normalizeTargets(loadConfig(projectRoot).providers);
      enabled = Object.entries(targets).filter(([, t]) => t.enabled).map(([id]) => id);
    } catch { /* steps fall back to the generic form */ }
  }

  const r = compareProviders(fromId, toId, { enabled });
  if (values?.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  heading(`Migrate: ${r.from.name} → ${r.to.name}`);
  const yesNo = v => (v ? 'yes' : 'no');
  table([
    ['', `${r.from.name}  →  ${r.to.name}`],
    ['Always-on file', `${TARGETS[fromId].mainFile}  →  ${TARGETS[toId].mainFile}`],
    ['Path scoping', `${r.scoping.from}  →  ${r.scoping.to}`],
    ['Skills dir', `${r.skills.from || 'not supported'}  →  ${r.skills.to || 'not supported'}`],
    ['Reads AGENTS.md', `${yesNo(r.agentsMd.from)}  →  ${yesNo(r.agentsMd.to)}`],
    ['Size budget', `${r.budget.fromLabel}  →  ${r.budget.toLabel}`],
    ['Instruction style', `${r.style.from}  →  ${r.style.to}`],
  ]);
  if (r.budget.to.note) dim(r.budget.to.note);
  if (r.scoping.lost) warn(`${r.to.name} has no glob scoping — path-scoped rules are inlined as sections.`);

  if (r.models.to.length || r.models.from.length) {
    console.log();
    info('Models (registry):');
    if (r.models.gained.length) success(`Only in ${r.to.name}: ${r.models.gained.slice(0, 8).join(', ')}`);
    if (r.models.lost.length) warn(`Not in ${r.to.name}: ${r.models.lost.slice(0, 8).join(', ')}`);
    if (!r.models.gained.length && !r.models.lost.length) dim('Same model lineup.');
  }

  if (r.notes) {
    console.log();
    dim(r.notes);
  }

  console.log();
  info('Steps:');
  r.migrationSteps.forEach((step, i) => dim(`${i + 1}. ${step}`));
  if (!enabled.length) dim('(No .cortex/ here — run `cortex init` first.)');
  console.log();
}
