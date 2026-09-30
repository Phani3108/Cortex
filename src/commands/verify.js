// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex verify — check that every tool reads what .cortex/ says.
 *
 *   - generated files exist and match a fresh compile (no drift, no hand edits)
 *   - hard budgets respected (rules dropped to fit are listed), soft budgets flagged
 *   - unknown providers in config.yaml, stale model registry
 *
 * Exit 1 on errors; with --strict, also on warnings. --json for CI.
 */

import { findProjectRoot } from '../utils/fs.js';
import { heading, success, warn, error, dim, info } from '../utils/log.js';
import { requireCortex, inspectProject, collectFindings, registryHealth } from '../core/health.js';
import { generateTips, formatTipsForDisplay } from '../core/tips.js';
import { resolveTargetId, TARGETS } from '../engine/index.js';

// Target lines go to stdout (log.error writes to stderr, which interleaves badly).
const fail = msg => console.log(process.env.NO_COLOR !== undefined ? `  ✗ ${msg}` : `  \x1b[31m✗\x1b[0m ${msg}`);

export default async function verify({ values }) {
  const projectRoot = findProjectRoot();
  requireCortex(projectRoot);

  let only = null;
  if (values.provider) {
    const id = resolveTargetId(values.provider);
    if (!id) {
      error(`Unknown provider '${values.provider}'. Known: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }
    only = [id];
  }

  let inspection;
  try {
    inspection = inspectProject(projectRoot, { only });
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  if (only && !inspection.report[only[0]]) {
    error(`Provider '${only[0]}' is not enabled. Set providers.${only[0]}: true in .cortex/config.yaml`);
    process.exit(1);
  }

  const registry = registryHealth();
  const findings = collectFindings(inspection, registry);
  const errors = findings.filter(f => f.level === 'error');
  const warnings = findings.filter(f => f.level === 'warning');
  const failed = errors.length > 0 || (values.strict && warnings.length > 0);

  if (values.json) {
    console.log(JSON.stringify({
      ok: !failed,
      strict: !!values.strict,
      errors,
      warnings,
      targets: Object.fromEntries(Object.values(inspection.targets).map(t => [t.id, {
        name: t.name,
        status: t.status,
        alwaysOn: t.alwaysOn,
        viaAgentsMd: t.viaAgentsMd,
        budget: t.budget,
        dropped: t.dropped.map(r => r.text),
        files: t.files,
      }])),
      registry: { lastUpdated: registry.lastUpdated, ageDays: Number.isFinite(registry.ageDays) ? registry.ageDays : null, modelCount: registry.modelCount, status: registry.status },
    }, null, 2));
    process.exitCode = failed ? 1 : 0;
    return;
  }

  heading('Verifying generated files');
  dim(projectRoot);
  console.log();

  for (const t of Object.values(inspection.targets)) {
    const mine = findings.filter(f => f.target === t.id);
    const label = t.viaAgentsMd && !t.files.length ? `${t.name} (via AGENTS.md)` : t.name;
    const budget = t.budget.size !== null
      ? ` · ${t.budget.size}${t.budget.hard ? `/${t.budget.hard}` : t.budget.soft ? `/~${t.budget.soft}` : ''} ${t.budget.unit}`
      : '';
    if (mine.some(f => f.level === 'error')) fail(`${label}${budget}`);
    else if (mine.length) warn(`${label}${budget}`);
    else success(`${label}${budget}`);
    for (const f of mine) {
      dim(`${f.level === 'error' ? '✗' : '⚠'} ${f.message}`);
      for (const rule of (f.rules || []).slice(0, 5)) dim(`    − ${rule.slice(0, 90)}`);
    }
    const out = t.alwaysOnOutput;
    if (out && !t.viaAgentsMd) {
      const tips = generateTips(out.content, inspection.config.providers?.[t.id]?.model, t.id, { rules: inspection.rules })
        .filter(tip => tip.category !== 'budget'); // budgets are already reported above
      const text = formatTipsForDisplay(tips);
      if (text) console.log(text);
    }
  }

  const general = findings.filter(f => !f.target);
  if (general.length) {
    console.log();
    for (const f of general) (f.level === 'error' ? fail : warn)(f.message + (f.fix && f.code !== 'registry-stale' ? ` (${f.fix})` : ''));
  }

  console.log();
  info(`Registry: ${registry.modelCount} models from ${registry.source}, ${Number.isFinite(registry.ageDays) ? `${registry.ageDays} day(s) old` : 'never updated'}`);
  const fixes = [...new Set(errors.map(f => f.fix).filter(Boolean))];
  if (!errors.length && !warnings.length) success('All checks passed.');
  else if (!failed) success(`Passed with ${warnings.length} warning(s).`);
  else {
    error(`${errors.length} error(s), ${warnings.length} warning(s).`);
    for (const fix of fixes.slice(0, 3)) dim(`Fix: ${fix}`);
  }
  process.exitCode = failed ? 1 : 0;
}
