// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Project inspection + health — shared by `verify`, `status`, `diff` and the
 * analysis commands. Health means three things only:
 *
 *   1. generated files match what `cortex compile` would write now,
 *   2. every target's size budget is respected,
 *   3. the model registry (pricing, context windows) is fresh.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCortexDir } from '../utils/fs.js';
import { error as logError } from '../utils/log.js';
import { TARGETS, measure, normalizeTargets, compile } from '../engine/index.js';
import { compileProject, profileRules } from './sources.js';
import { loadProfile } from './profile.js';
import { loadManifest, manifestEntry } from './manifest.js';
import { getRegistryInfo } from './registry.js';
import { planWrites, planRemovals } from './outputs.js';

const STALE_DAYS = 7;
const CRITICAL_DAYS = 30;

/** True when the project has a .cortex/ with a config or rules. */
export function hasCortex(projectRoot) {
  const dir = getCortexDir(projectRoot);
  return existsSync(join(dir, 'config.yaml')) || existsSync(join(dir, 'rules'));
}

/** Exit with a clear message when .cortex/ is missing. */
export function requireCortex(projectRoot) {
  if (hasCortex(projectRoot)) return;
  logError('.cortex/ not found. Run `cortex init` first.');
  process.exit(1);
}

/**
 * Compile in memory and compare with disk. Never writes.
 * @returns engine result + { manifest, plan, removals, unknown, targets }
 */
export function inspectProject(projectRoot, { only = null } = {}) {
  const result = compileProject(projectRoot, { only });
  const manifest = loadManifest(projectRoot);
  const compiledTargets = Object.keys(result.report);
  const plan = planWrites(projectRoot, result.outputs, manifest);
  const removals = planRemovals(projectRoot, result.outputs, manifest, compiledTargets);
  const { unknown } = normalizeTargets(result.config.providers);
  const agentsMd = result.outputs.find(o => o.path === TARGETS.codex.mainFile) || null;

  const targets = {};
  for (const [id, entry] of Object.entries(result.report)) {
    const target = TARGETS[id];
    const files = plan
      .filter(p => (p.output.targets || [p.output.target]).includes(id))
      .map(p => ({ file: p.file, kind: p.output.kind, action: p.action, reason: p.reason || null, tokens: p.output.tokens }));
    const own = result.outputs.find(o => o.kind === 'instructions' && (o.targets || [o.target]).includes(id));
    const alwaysOn = own || (entry.viaAgentsMd ? agentsMd : null);
    const { unit, soft, hard } = target.budget;
    const size = own ? measure(own.content, unit) : null;

    targets[id] = {
      id,
      name: target.name,
      viaAgentsMd: entry.viaAgentsMd,
      alwaysOn: alwaysOn?.path || null,
      alwaysOnOutput: alwaysOn,
      budget: { unit, soft, hard, size, overSoft: !!(soft && size > soft), overHard: !!(hard && size > hard) },
      dropped: entry.dropped,
      files,
      status: fileStatus(files),
    };
  }
  return { ...result, manifest, plan, removals, unknown, targets };
}

/**
 * Compile one target on its own (even if disabled in config), from the
 * sources an inspection already loaded. Used to analyse "what if" targets.
 */
export function compileTargetAlone(inspection, id) {
  const model = inspection.config.providers?.[id]?.model;
  return compile({
    ruleFiles: inspection.ruleFiles,
    skillFiles: inspection.skillFiles,
    config: { ...inspection.config, providers: { [id]: model ? { enabled: true, model } : true } },
    extraRules: profileRules(loadProfile()),
  });
}

function fileStatus(files) {
  if (files.some(f => f.action === 'conflict')) return 'conflict';
  if (files.length && files.every(f => f.action === 'create')) return 'not_compiled';
  if (files.some(f => f.action === 'create' || f.action === 'update')) return 'stale';
  return 'up_to_date';
}

/** Registry freshness summary. */
export function registryHealth() {
  const reg = getRegistryInfo();
  const days = reg.ageDays;
  let status = 'fresh';
  if (!Number.isFinite(days)) status = 'missing';
  else if (days > CRITICAL_DAYS) status = 'critical';
  else if (days > STALE_DAYS) status = 'stale';
  const message = status === 'missing'
    ? 'Model registry has no data. Run `cortex update`.'
    : status === 'fresh'
      ? `Model registry is ${days} day(s) old.`
      : `Model registry is ${days} days old — pricing and context windows may be out of date. Run \`cortex update\`.`;
  return { status, ...reg, message };
}

/**
 * Turn an inspection into findings: { level: 'error'|'warning', code, target?, file?, message, fix? }.
 * Errors mean the tools are not reading what .cortex/ says; warnings are advisory.
 */
export function collectFindings(inspection, registry = registryHealth()) {
  const out = [];
  const add = (level, code, message, extra = {}) => out.push({ level, code, message, ...extra });

  if (!Object.keys(inspection.report).length) {
    add('warning', 'no-targets', 'No providers enabled.', { fix: 'Enable tools under `providers:` in .cortex/config.yaml' });
  }
  for (const key of inspection.unknown) {
    add('warning', 'unknown-provider', `Unknown provider "${key}" in config.yaml is ignored.`, { fix: `Remove it or use one of: ${Object.keys(TARGETS).join(', ')}` });
  }
  for (const w of inspection.warnings) {
    if (!/^Unknown provider/.test(w)) add('warning', 'compile', w);
  }

  for (const p of inspection.plan) {
    const target = p.output.targets?.[0] || p.output.target;
    if (p.action === 'create') {
      add('error', 'missing', `${p.file} has not been generated.`, { target, file: p.file, fix: 'cortex compile' });
    } else if (p.action === 'update') {
      add('error', 'stale', `${p.file} is out of date with .cortex/.`, { target, file: p.file, fix: 'cortex compile' });
    } else if (p.action === 'conflict' && /hand-written/.test(p.reason)) {
      add('error', 'hand-written', `${p.file} exists but was not generated by Cortex.`, { target, file: p.file, fix: 'cortex import, then cortex compile --force' });
    } else if (p.action === 'conflict') {
      add('error', 'hand-edited', `${p.file} was edited by hand since the last compile.`, { target, file: p.file, fix: 'cortex diff to review, move edits into .cortex/rules, then cortex compile --force' });
    }
  }
  for (const r of inspection.removals) {
    const target = manifestEntry(inspection.manifest, r.file)?.targets?.[0];
    if (r.action === 'delete') add('error', 'orphan', `${r.file} is ${r.reason}.`, { target, file: r.file, fix: 'cortex compile (removes it)' });
    else add('warning', 'orphan-edited', `${r.file} is ${r.reason}.`, { target, file: r.file, fix: 'Delete it once you have moved the edits into .cortex/' });
  }

  for (const t of Object.values(inspection.targets)) {
    const b = t.budget;
    if (b.overHard) {
      add('error', 'over-budget', `${t.alwaysOn} is ${b.size} ${b.unit}; ${t.name} reads at most ${b.hard}.`, { target: t.id, file: t.alwaysOn, fix: 'Shorten or scope rules in .cortex/rules' });
    }
    if (t.dropped.length) {
      const critical = t.dropped.filter(r => r.priority === 'critical').length;
      add(critical ? 'error' : 'warning', 'dropped-rules',
        `${t.dropped.length} rule(s) left out of ${t.alwaysOn} to fit ${b.hard} ${b.unit}${critical ? ` (${critical} critical)` : ''}.`,
        { target: t.id, file: t.alwaysOn, rules: t.dropped.map(r => r.text), fix: 'cortex optimize -p ' + t.id });
    }
    if (b.overSoft) {
      add('warning', 'soft-budget', `${t.alwaysOn} is ${b.size} ${b.unit} (guidance for ${t.name}: ≤ ${b.soft}).`, { target: t.id, file: t.alwaysOn, fix: 'Move file-specific rules into scoped rule files' });
    }
  }

  if (registry.status !== 'fresh') {
    add('warning', 'registry-stale', registry.message, { fix: 'cortex update' });
  }
  return out;
}

/**
 * Health report for a project (programmatic API; also used by `status`).
 * `config` is accepted for backward compatibility — sources are re-read from disk.
 */
export function assessHealth(projectRoot, _config) {
  const registry = registryHealth();
  let inspection;
  try {
    inspection = inspectProject(projectRoot);
  } catch (err) {
    return {
      overall: { score: 0, label: 'needs_attention' },
      registry,
      providers: {},
      findings: [{ level: 'error', code: 'config', message: err.message }],
      recommendations: [{ priority: 'high', message: err.message }],
    };
  }
  const findings = collectFindings(inspection, registry);
  const errors = findings.filter(f => f.level === 'error').length;
  const warnings = findings.length - errors;
  const score = Math.max(0, 100 - errors * 15 - warnings * 5);

  const providers = {};
  for (const t of Object.values(inspection.targets)) {
    providers[t.id] = {
      name: t.name,
      status: t.status,
      alwaysOn: t.alwaysOn,
      viaAgentsMd: t.viaAgentsMd,
      files: t.files,
      budget: t.budget,
      issues: findings.filter(f => f.target === t.id),
    };
  }

  const seen = new Set();
  const recommendations = [];
  for (const f of findings) {
    if (!f.fix || seen.has(f.fix)) continue;
    seen.add(f.fix);
    recommendations.push({ priority: f.level === 'error' ? 'high' : 'medium', message: `${f.fix} — ${f.message}` });
  }

  return { overall: { score, label: scoreLabel(score) }, registry, providers, unknownProviders: inspection.unknown, findings, recommendations };
}

function scoreLabel(score) {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'needs_attention';
}
