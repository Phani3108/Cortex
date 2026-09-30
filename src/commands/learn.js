// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex learn — the real learning pipeline.
 *
 * Captures signals from the project, distills them into adaptation plans,
 * and evolves .cortex/ rules — making every AI tool smarter next time.
 *
 * Signal sources:
 * 1. User edits to compiled output files (strongest signal)
 * 2. Project configs (.eslintrc, tsconfig, etc. → implicit rules)
 * 3. Git history (commit patterns, conventional commits, etc.)
 * 4. Code style analysis (semicolons, quotes, etc.)
 * 5. Existing provider rules (reverse-import)
 */

import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { captureSignals, SIGNAL_TYPES } from '../core/signals.js';
import { distillSignals, applyAdaptation, loadAdaptationState, saveAdaptationState } from '../core/adapt.js';
import { loadSession, saveSession, recordAction, updateMetrics } from '../core/session.js';
import { heading, info, success, error, dim, table } from '../utils/log.js';

/**
 * Flags: --dry (preview), --auto (non-interactive, for hooks/watch),
 * --quiet (no output except errors).
 */
export default async function learn({ values = {}, positionals = [] }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const dry = Boolean(values.dry);
  const quiet = Boolean(values.quiet) || positionals.includes('--quiet');
  const say = fn => (...args) => { if (!quiet) fn(...args); };
  const log = { heading: say(heading), info: say(info), success: say(success), dim: say(dim), table: say(table), blank: say(() => console.log()) };

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exitCode = 1;
    return;
  }

  log.heading('Learning from project signals');
  log.info('Scanning for signals...');
  const signalReport = captureSignals(projectRoot);

  if (signalReport.totalSignals === 0) {
    log.info('No signals detected. Context is up to date.');
    log.dim('Signals come from: project configs, git history, code style, existing rules');
    return;
  }

  log.blank();
  log.info(`Captured ${signalReport.totalSignals} signals:`);
  log.table(Object.entries(signalReport.byType).map(([type, items]) => [
    formatSignalType(type),
    `${items.length} signal(s)`,
  ]));

  // Distill, then preview against what's already in .cortex/rules/
  const plan = distillSignals(signalReport);
  const preview = applyAdaptation(projectRoot, plan, { dry: true });
  const rel = p => relative(projectRoot, p) || p;

  for (const e of preview.errors) error(`${e.type}: ${e.error}`);

  if (preview.applied.length === 0) {
    log.blank();
    log.success('Context is up to date.');
    printSuggestedRemovals(preview.suggestedRemovals, log, rel);
    return;
  }

  if (dry) {
    log.blank();
    log.info('Dry run — would add:');
    for (const a of preview.applied) {
      for (const item of a.items) log.dim(`+ [${a.type}] ${item}`);
    }
    printSuggestedRemovals(preview.suggestedRemovals, log, rel);
    return;
  }

  const results = applyAdaptation(projectRoot, plan);
  for (const e of results.errors) error(`${e.type}: ${e.error}`);
  if (results.applied.length === 0) {
    log.success('Context is up to date.');
    return;
  }

  const rulesAdded = results.applied.reduce((n, a) => n + a.count, 0);

  // Update adaptation state — only when something was actually applied
  const state = loadAdaptationState(projectRoot) || {};
  state.version = state.version || 1;
  state.lastAdapted = new Date().toISOString();
  state.totalCycles = (Number(state.totalCycles) || 0) + 1;
  state.signalCounts = state.signalCounts && typeof state.signalCounts === 'object' ? state.signalCounts : {};
  for (const signal of signalReport.signals) {
    state.signalCounts[signal.type] = (Number(state.signalCounts[signal.type]) || 0) + 1;
  }
  saveAdaptationState(projectRoot, state);

  // Record in the project session so metrics reflect real events
  const session = loadSession(projectRoot);
  updateMetrics(session, { signalsCaptured: signalReport.totalSignals, rulesEvolved: rulesAdded, rulesAdded });
  recordAction(session, 'learn', { rulesAdded });
  saveSession(session);

  log.blank();
  for (const applied of results.applied) {
    log.success(`${applied.type}: ${applied.count} rule(s) → ${rel(applied.path)}`);
  }
  printSuggestedRemovals(results.suggestedRemovals, log, rel);
  log.blank();
  log.success(`Adaptation cycle #${state.totalCycles} complete`);
  log.dim('Run `cortex compile` to propagate learned rules to all providers.');
}

function printSuggestedRemovals(removals, log, rel) {
  if (!removals?.length) return;
  log.blank();
  log.info(`Suggested removals (${removals.length}) — you deleted these from generated files:`);
  for (const r of removals) {
    const where = r.locations.map(l => `${rel(l.file)}:${l.line}`).join(', ');
    log.dim(`- ${r.content}`);
    log.dim(`  edit ${where}`);
  }
}

function formatSignalType(type) {
  const names = {
    [SIGNAL_TYPES.USER_EDIT]: 'User edits',
    [SIGNAL_TYPES.GIT_PATTERN]: 'Git patterns',
    [SIGNAL_TYPES.PROVIDER_RULE]: 'Provider rules',
    [SIGNAL_TYPES.PROJECT_CONFIG]: 'Project configs',
    [SIGNAL_TYPES.STYLE_SIGNAL]: 'Code style',
    [SIGNAL_TYPES.CORRECTION]: 'Corrections',
  };
  return names[type] || type;
}
