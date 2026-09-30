// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex status — enabled targets, their generated files and whether each is
 * up to date, plus sources and registry info.
 */

import { findProjectRoot } from '../utils/fs.js';
import { loadProfile } from '../core/profile.js';
import { heading, info, warn, dim, table, success, error } from '../utils/log.js';
import { requireCortex, inspectProject, collectFindings, registryHealth } from '../core/health.js';
import { TARGETS, formatTokens } from '../engine/index.js';

const STATE = {
  up_to_date: '✓ up to date',
  stale: '⚠ out of date — run `cortex compile`',
  not_compiled: '✗ not compiled — run `cortex compile`',
  conflict: '✗ hand-edited/hand-written file — see `cortex verify`',
};

const ACTION = { unchanged: '✓', create: '+ missing', update: '~ stale', conflict: '✗ edited' };

export default async function status({ values }) {
  const projectRoot = findProjectRoot();
  requireCortex(projectRoot);

  let inspection;
  try {
    inspection = inspectProject(projectRoot);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
  const { config, rules, skills, targets, unknown } = inspection;
  const registry = registryHealth();
  const findings = collectFindings(inspection, registry);

  if (values.json) {
    console.log(JSON.stringify({
      project: config.project || {},
      rules: rules.length,
      skills: skills.length,
      targets: Object.fromEntries(Object.values(targets).map(t => [t.id, { name: t.name, status: t.status, viaAgentsMd: t.viaAgentsMd, files: t.files }])),
      unknownProviders: unknown,
      registry: { modelCount: registry.modelCount, lastUpdated: registry.lastUpdated, source: registry.source, ageDays: Number.isFinite(registry.ageDays) ? registry.ageDays : null },
      issues: findings,
    }, null, 2));
    return;
  }

  heading('Cortex status');
  dim(projectRoot);

  const project = config.project || {};
  const bits = [project.name, project.language, project.framework].filter(Boolean);
  if (bits.length) info(`Project: ${bits.join(' · ')}`);
  info(`Sources: ${rules.length} rule(s), ${skills.length} skill(s)`);

  console.log();
  const enabled = Object.values(targets);
  if (!enabled.length) warn('No providers enabled — set them under `providers:` in .cortex/config.yaml');
  for (const t of enabled) {
    info(`${t.name}  ${STATE[t.status] || t.status}`);
    if (t.viaAgentsMd) dim(`always-on rules via ${TARGETS.codex.mainFile}`);
    for (const f of t.files) {
      const kind = f.kind === 'instructions' ? `~${formatTokens(f.tokens)} tokens` : f.kind;
      dim(`${(ACTION[f.action] || f.action).padEnd(10)} ${f.file}  (${kind})`);
    }
  }
  const disabled = Object.keys(TARGETS).filter(id => !targets[id]);
  if (disabled.length) dim(`Disabled: ${disabled.join(', ')}`);
  for (const key of unknown) warn(`Unknown provider "${key}" in config.yaml — ignored.`);
  for (const r of inspection.removals) warn(`${r.file}: ${r.reason}`);

  console.log();
  const age = Number.isFinite(registry.ageDays) ? `${registry.ageDays} day(s) old` : 'never updated';
  table([
    ['Registry', `${registry.modelCount} models · ${registry.source} · ${age}${registry.status === 'fresh' ? '' : ' — run `cortex update`'}`],
  ]);

  const profile = loadProfile();
  if (profile._exists) table([['Profile', `~/.cortex/profile.yaml${profile.name ? ` (${profile.name})` : ''}`]]);

  console.log();
  const errors = findings.filter(f => f.level === 'error').length;
  if (!errors && findings.length === 0) success('Everything is up to date.');
  else dim(`${errors} error(s), ${findings.length - errors} warning(s) — run \`cortex verify\` for details.`);
  console.log();
}
