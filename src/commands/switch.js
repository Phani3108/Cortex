// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex switch — what changes when a tool moves from one model to another:
 * tokens for the same instructions, input price, context window and the
 * instruction style Cortex compiles for.
 *
 *   cortex switch claude-sonnet-5.5 gpt-6.1-sol
 */

import { findProjectRoot } from '../utils/fs.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';
import { compareModels } from '../core/compare.js';
import { hasCortex, inspectProject } from '../core/health.js';
import { analyzeProject } from '../core/tokens.js';
import { formatPrice, formatUSD } from '../core/budget.js';
import { formatTokens } from '../engine/index.js';

export default async function switchCmd({ positionals, values }) {
  const [fromModel, toModel] = positionals;
  if (!fromModel || !toModel) {
    error('Usage: cortex switch <from-model> <to-model>');
    dim('Example: cortex switch claude-sonnet-5.5 gpt-6.1-sol');
    process.exit(1);
  }

  // Measure the project's always-on instructions and included files, if any.
  let chars = 0;
  let projectChars = 0;
  let source = null;
  const projectRoot = findProjectRoot();
  if (hasCortex(projectRoot)) {
    try {
      const inspection = inspectProject(projectRoot);
      const main = Object.values(inspection.targets).map(t => t.alwaysOnOutput).filter(Boolean)
        .sort((x, y) => y.content.length - x.content.length)[0];
      if (main) { chars = main.content.length; source = main.path; }
      const skip = new Set(inspection.outputs.map(o => o.path));
      projectChars = analyzeProject(projectRoot, inspection.config.context || {}, { skip }).totalSize;
    } catch (err) {
      warn(`Could not read .cortex/: ${err.message}`);
    }
  }

  const r = compareModels(fromModel, toModel, { chars, projectChars });
  if (values?.json) {
    console.log(JSON.stringify({ ...r, source }, null, 2));
    return;
  }

  heading(`Model switch: ${r.from.model} → ${r.to.model}`);
  for (const side of [r.from, r.to]) {
    if (!side.estimated) continue;
    if (side.family === 'unknown') warn(`'${side.name}' is not a known model family — using generic estimates (~est.).`);
    else warn(`'${side.name}' is not in the registry — ${side.basis ? `priced like ${side.basis}` : 'family defaults'} (~est.). Run \`cortex update\`.`);
  }
  const est = s => (s.estimated ? ' ~est.' : '');

  if (source) {
    console.log();
    info(`Always-on instructions (${source}):`);
    table([
      [r.from.model, `~${formatTokens(r.from.tokens)} tokens · ${formatUSD(r.from.per1kSessions)} per 1K sessions${est(r.from)}`],
      [r.to.model, `~${formatTokens(r.to.tokens)} tokens · ${formatUSD(r.to.per1kSessions)} per 1K sessions${est(r.to)}  (${r.tokenDelta.change} tokens)`],
    ]);
  } else {
    dim('No .cortex/ here — comparing models only.');
  }

  console.log();
  info('Pricing (per 1M tokens):');
  const price = s => `${formatPrice(s.inputPer1M)} in${s.outputPer1M !== null ? ` · ${formatPrice(s.outputPer1M)} out` : ''}${s.cacheReadPer1M !== null ? ` · ${formatPrice(s.cacheReadPer1M)} cached` : ''}${est(s)}`;
  table([[r.from.model, price(r.from)], [r.to.model, price(r.to)]]);
  dim(`Input price ${r.costDelta.change} (${r.costDelta.direction.replace('_', ' ')}).`);

  console.log();
  info('Context window:');
  table([
    [r.from.model, `${formatTokens(r.from.contextWindow)} tokens${est(r.from)}`],
    [r.to.model, `${formatTokens(r.to.contextWindow)} tokens${est(r.to)}`],
  ]);
  if (projectChars && !r.contextWindow.fits) {
    warn(`Instructions + included files (~${formatTokens(r.to.tokens + r.to.projectTokens)} tokens) exceed ${r.to.model}'s window; the tool will read files selectively.`);
  }

  if (r.capabilities.length) {
    console.log();
    info('Capability changes (registry data):');
    for (const c of r.capabilities) {
      const line = `${c.label}: ${formatTokens(c.from)} → ${formatTokens(c.to)}`;
      if (c.direction === 'gained') success(`Larger ${line}`);
      else warn(`Smaller ${line}`);
    }
  }

  console.log();
  if (r.formatChange.changed) {
    warn(`Instruction style changes: ${r.formatChange.from} → ${r.formatChange.to}.`);
    dim(`Set \`providers.<tool>: { enabled: true, model: ${r.to.model} }\` in .cortex/config.yaml, then run \`cortex compile\`.`);
  } else {
    success(`Same instruction style (${r.formatChange.from}) — no recompile needed.`);
  }
  console.log();
}
