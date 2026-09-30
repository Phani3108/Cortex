// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex compile — build native instruction files for every enabled tool.
 *
 *   cortex compile            write files (never clobbers hand-written files)
 *   cortex compile --check    CI mode: exit 1 if any generated file is stale
 *   cortex compile --dry      show the plan without writing
 *   cortex compile -p cursor  only one target
 *   cortex compile --force    overwrite hand-written / hand-edited files
 *   cortex compile --json     machine-readable report
 */

import { join, dirname } from 'node:path';
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { compileProject } from '../core/sources.js';
import { loadManifest, saveManifest } from '../core/manifest.js';
import { planWrites, planRemovals, pruneEmptyDirs } from '../core/outputs.js';

export { planWrites, planRemovals };
import { loadSession, saveSession, recordAction, updateMetrics } from '../core/session.js';
import { TARGETS, resolveTargetId, formatTokens } from '../engine/index.js';
import { heading, success, info, warn, error, dim } from '../utils/log.js';
import { findRedundantOriginals } from './import.js';

export default async function compile({ values }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const { force, dry, check, quiet, json } = values;
  const say = quiet || json ? () => {} : fn => fn();

  if (!existsSync(join(cortexDir, 'config.yaml')) && !existsSync(join(cortexDir, 'rules'))) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exit(1);
  }

  let only = null;
  if (values.provider) {
    const id = resolveTargetId(values.provider);
    if (!id) {
      error(`Unknown provider '${values.provider}'. Known: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }
    only = [id];
  }

  let result;
  try {
    result = compileProject(projectRoot, { only });
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
  const { outputs, report, warnings, rules, skills, config } = result;
  const compiledTargets = Object.keys(report);

  if (only && !compiledTargets.length) {
    error(`Provider '${only[0]}' is not enabled. Set providers.${only[0]}: true in .cortex/config.yaml`);
    process.exit(1);
  }
  if (!compiledTargets.length) {
    warn('No providers enabled. Enable them under `providers:` in .cortex/config.yaml');
    process.exit(0);
  }

  // ── Plan ──────────────────────────────────────────────────────────────────
  const manifest = loadManifest(projectRoot);
  const plan = planWrites(projectRoot, outputs, manifest, { force });
  const removals = planRemovals(projectRoot, outputs, manifest, compiledTargets);

  const drift = [
    ...plan.filter(p => p.action === 'create' || p.action === 'update'),
    ...removals.filter(r => r.action === 'delete'),
  ];
  const conflicts = plan.filter(p => p.action === 'conflict');

  if (json) {
    console.log(JSON.stringify({
      check: !!check,
      targets: report,
      files: plan.map(p => ({ path: p.file, action: p.action, reason: p.reason || null, targets: p.output.targets, tokens: p.output.tokens })),
      removals: removals.map(r => ({ path: r.file, action: r.action, reason: r.reason })),
      warnings,
      upToDate: drift.length === 0 && conflicts.length === 0,
    }, null, 2));
    if (check) process.exit(drift.length || conflicts.length ? 1 : 0);
  }

  // ── Check mode (CI) ─────────────────────────────────────────────────────
  if (check) {
    if (!drift.length && !conflicts.length) {
      if (!quiet && !json) success(`All ${plan.length} generated file(s) are up to date.`);
      process.exit(0);
    }
    if (!json) {
      error(`${drift.length + conflicts.length} generated file(s) are out of date with .cortex/:`);
      for (const d of [...drift, ...conflicts]) console.error(`    ${d.action.padEnd(8)} ${d.file}${d.reason ? `  (${d.reason})` : ''}`);
      console.error('  Run `cortex compile` and commit the result.');
    }
    process.exit(1);
  }

  say(() => {
    heading('Compiling AI context');
    dim(`${rules.length} rule(s), ${skills.length} skill(s) → ${compiledTargets.length} target(s)`);
    for (const w of warnings) warn(w);
  });

  // ── Apply ───────────────────────────────────────────────────────────────
  const written = [];
  for (const p of plan) {
    if (p.action === 'unchanged') continue;
    if (p.action === 'conflict') {
      if (!json) warn(`Skipped ${p.file} — ${p.reason}`);
      continue;
    }
    if (dry) {
      say(() => dim(`[dry] would ${p.action} ${p.file}`));
      continue;
    }
    mkdirSync(dirname(p.abs), { recursive: true });
    writeFileSync(p.abs, p.output.content, 'utf-8');
    written.push(p);
    say(() => success(`${p.action === 'create' ? 'Created' : 'Updated'} ${p.file}`));
  }
  for (const r of removals) {
    if (r.action === 'keep') {
      if (!json) warn(`Left ${r.file} in place — ${r.reason}`);
      continue;
    }
    if (dry) { say(() => dim(`[dry] would delete ${r.file} (${r.reason})`)); continue; }
    try {
      unlinkSync(r.abs);
      pruneEmptyDirs(dirname(r.abs), projectRoot);
      say(() => dim(`Removed ${r.file} (${r.reason})`));
    } catch { /* already gone */ }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  say(() => printReport(report, outputs, config));

  if (!dry) {
    const tracked = plan.filter(p => p.action !== 'conflict').map(p => ({ ...p.output, path: p.file }));
    saveManifest(projectRoot, tracked, { compiledTargets });
    try {
      const session = loadSession(projectRoot);
      updateMetrics(session, { compilations: 1, filesGenerated: written.length, providersUsed: compiledTargets });
      recordAction(session, 'compiled', { providers: compiledTargets, files: written.length });
      saveSession(session);
    } catch { /* metrics are best-effort */ }
  }

  if (!dry && !quiet && !json) {
    const leftovers = findRedundantOriginals(projectRoot, new Set(outputs.map(o => o.path)), rules);
    for (const f of leftovers) warn(`${f} duplicates rules now compiled from .cortex/ — delete it so the tool doesn't load them twice.`);
  }

  const unchanged = plan.filter(p => p.action === 'unchanged').length;
  say(() => {
    console.log();
    const verb = dry ? 'Would write' : 'Wrote';
    success(`${verb} ${dry ? drift.length : written.length} file(s), ${unchanged} unchanged, ${conflicts.length} skipped.`);
    if (conflicts.length) dim('Skipped files were written by hand. Run `cortex import` to bring them into .cortex/, then `cortex compile --force`.');
    dim('Commit .cortex/ and the generated files; add `cortex compile --check` to CI to block drift.');
  });

  if (conflicts.length) process.exitCode = 1;
}

function printReport(report, outputs, config) {
  console.log();
  info('Targets');
  for (const entry of Object.values(report)) {
    const files = outputs.filter(o => (o.targets || [o.target]).includes(entry.id));
    const main = files.find(f => f.kind === 'instructions');
    const scoped = files.filter(f => f.kind === 'scoped').length;
    const skillCount = files.filter(f => f.kind === 'skill').length;
    const bits = [];
    if (entry.viaAgentsMd) bits.push('always-on rules via AGENTS.md');
    else if (main) bits.push(`${main.path} (~${formatTokens(main.tokens)} tokens)`);
    if (scoped) bits.push(`${scoped} scoped`);
    if (skillCount) bits.push(`${skillCount} skill(s)`);
    console.log(`    ${entry.name.padEnd(30)} ${bits.join(' · ')}`);
    for (const w of entry.warnings) dim(`  ⚠ ${w}`);
    for (const r of entry.dropped.slice(0, 5)) dim(`    − dropped: ${r.text.slice(0, 90)}`);
  }
  if (config.output?.agentsMd !== 'duplicate' && Object.values(report).some(e => e.viaAgentsMd)) {
    dim('Tools that read AGENTS.md natively get their always-on rules from it (set output.agentsMd: duplicate to change).');
  }
}
