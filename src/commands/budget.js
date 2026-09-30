// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex budget — where a session's context goes before you type anything.
 *
 *   cortex budget                       first enabled tool, its usual model
 *   cortex budget -m gpt-6.1-sol        a specific model
 *   cortex budget -p cursor             a specific tool
 */

import { findProjectRoot } from '../utils/fs.js';
import { heading, info, warn, error, dim, table } from '../utils/log.js';
import { requireCortex, inspectProject } from '../core/health.js';
import { analyzeBudget, formatUSD, formatPrice } from '../core/budget.js';
import { formatTokens, formatBytes } from '../core/tokens.js';
import { resolveTargetId, TARGETS } from '../engine/index.js';

export default async function budget({ values }) {
  const projectRoot = findProjectRoot();
  requireCortex(projectRoot);

  let targetId = null;
  if (values.provider) {
    targetId = resolveTargetId(values.provider);
    if (!targetId) {
      error(`Unknown provider '${values.provider}'. Known: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }
  }

  let result;
  try {
    result = analyzeBudget(projectRoot, null, values.model, targetId, { inspection: inspectProject(projectRoot) });
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const { model, target } = result;
  const est = model.estimated ? ' ~est.' : '';
  heading(`Token budget — ${model.id}${target ? ` in ${target.name}` : ''}`);

  if (model.estimated) {
    warn(model.basis
      ? `'${model.name}' is not in the registry — values estimated from ${model.basis}.`
      : `'${model.name}' is not in the registry — values are family defaults.`);
    dim('Run `cortex update` to refresh the registry.');
  }

  table([
    ['Context window', `${formatTokens(model.contextWindow)} tokens${est}`],
    ['Input price', `${formatPrice(model.input)}/1M tokens${est}${model.cacheRead !== null ? ` (cache read ${formatPrice(model.cacheRead)}/1M)` : ''}`],
  ]);

  console.log();
  info('Loaded every session:');
  if (!result.alwaysOn.files.length) dim('No always-on file — enable a provider and run `cortex compile`.');
  for (const f of result.alwaysOn.files) {
    dim(`${f.path.padEnd(36)} ~${formatTokens(f.tokens)} tokens`);
  }
  if (result.alwaysOn.files.length) {
    dim(`${'Total'.padEnd(36)} ~${formatTokens(result.alwaysOn.tokens)} tokens (${result.alwaysOn.percentage.toFixed(2)}% of window)`);
  }
  if (target?.viaAgentsMd) dim(`${target.name} reads these rules from AGENTS.md.`);
  if (result.onDemand.files) dim(`On demand: ${result.onDemand.scoped} scoped rule file(s), ${result.onDemand.skills} skill(s) — loaded only when relevant.`);

  console.log();
  info('Project files (context.include):');
  table([
    ['Text files', `${result.project.textFiles} (${formatBytes(result.project.totalSize)})`],
    ['Est. tokens', `~${formatTokens(result.project.modelTokens)}`],
    ['Window left', `~${formatTokens(result.available.tokens)} tokens after instructions`],
  ]);

  console.log();
  info('Instruction cost:');
  table([
    ['Per session', `${formatUSD(result.cost.perSession)}${est}${result.cost.perSessionCached !== null ? ` (${formatUSD(result.cost.perSessionCached)} when cached)` : ''}`],
    ['Per 1,000 sessions', `${formatUSD(result.cost.per1kSessions)}${est}`],
  ]);

  if (result.optimizations.length) {
    console.log();
    info('Suggestions:');
    for (const o of result.optimizations) (o.severity === 'high' ? warn : dim)(o.message);
  }

  console.log();
  info('Across current models (instructions + included files):');
  dim(`  ${'Model'.padEnd(26)} ${'Tokens'.padStart(8)} ${'Window'.padStart(8)} ${'Headroom'.padStart(9)} ${'$/1K sessions'.padStart(13)}`);
  for (const c of result.comparison) {
    const mark = c.current ? '→ ' : '  ';
    const name = `${c.model}${c.estimated ? ' ~est.' : ''}`;
    dim(`${mark}${name.padEnd(26)} ${formatTokens(c.tokens).padStart(8)} ${formatTokens(c.contextWindow).padStart(8)} ${(c.fits ? `${c.headroom.toFixed(0)}%` : 'over').padStart(9)} ${formatUSD(c.costPerSession * 1000).padStart(13)}`);
  }
  dim('Token counts are estimates (chars ÷ family chars-per-token).');
  console.log();
}
