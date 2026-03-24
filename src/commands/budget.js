// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex budget — Pre-session token intelligence dashboard.
 *
 * Shows users exactly where their tokens go BEFORE they start coding.
 * Identifies optimization opportunities and compares models side by side.
 *
 * Usage:
 *   cortex budget
 *   cortex budget --model claude-sonnet-4.6
 *   cortex budget --provider cursor
 */

import { findProjectRoot } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { analyzeBudget } from '../core/budget.js';
import { resolveModel } from '../core/families.js';
import { formatTokens, formatBytes } from '../core/tokens.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';

export default async function budget({ values }) {
  const projectRoot = findProjectRoot();
  const config = loadConfig(projectRoot);

  const modelName = values.model || 'claude-sonnet-4';
  const providerSlug = values.provider || detectProviderForModel(modelName);

  heading(`Token Budget Report — ${modelName}`);
  info(`Project: ${projectRoot}`);
  console.log();

  const result = analyzeBudget(projectRoot, config, modelName, providerSlug);

  // Model info
  info('Model:');
  table([
    ['Name', result.model.name],
    ['Family', `${result.model.family} (${result.model.tier || 'default'} tier)`],
    ['Context window', `${formatTokens(result.model.contextWindow)} tokens`],
    ['Cost', `$${result.model.costPer1M.toFixed(2)}/1M tokens`],
  ]);
  console.log();

  // Pre-allocated context
  if (result.preAllocated.files.length > 0) {
    info('Pre-allocated (always loaded):');
    const rows = result.preAllocated.files.map(f => [
      f.path,
      `${formatTokens(f.tokens)} tokens  (${result.model.contextWindow > 0 ? (f.tokens / result.model.contextWindow * 100).toFixed(1) : '0'}%)`,
    ]);
    rows.push(['─── Total', `${formatTokens(result.preAllocated.totalTokens)} tokens  (${result.preAllocated.percentage}%)`]);
    table(rows);
    console.log();
  }

  // Project context
  info('Project Context (if fully indexed):');
  table([
    ['Text files', `${result.projectContext.textFiles}`],
    ['Binary files', `${result.projectContext.binaryFiles} (excluded)`],
    ['Total size', formatBytes(result.projectContext.totalSize)],
    ['Est. tokens', formatTokens(result.projectContext.totalTokens)],
  ]);
  console.log();

  // Available for conversation
  info('Available for Conversation:');
  table([
    ['Remaining tokens', formatTokens(result.available.tokens)],
    ['Remaining %', `${result.available.percentage}%`],
    ['Est. characters', `~${(result.available.characters / 1000).toFixed(0)}K chars`],
    ['Est. exchanges', `~${result.available.estimatedExchanges} back-and-forth`],
  ]);
  console.log();

  // Cost estimates
  info('Cost Estimates:');
  table([
    ['Per context load', result.cost.perLoad < 0.01 ? '< $0.01' : `$${result.cost.perLoad.toFixed(4)}`],
    ['Per session (~3 loads)', result.cost.perSession < 0.01 ? '< $0.01' : `$${result.cost.perSession.toFixed(2)}`],
    ['Monthly (20 sessions)', `$${result.cost.perMonth.toFixed(2)}`],
  ]);
  console.log();

  // Optimization opportunities
  if (result.optimizations.length > 0) {
    info('Optimization Opportunities:');
    for (const opt of result.optimizations) {
      const icon = opt.severity === 'high' ? '⚡'
        : opt.severity === 'medium' ? '📉'
        : '💡';
      const line = opt.savings > 0
        ? `${icon} ${opt.message} (save ~${formatTokens(opt.savings)} tokens)`
        : `${icon} ${opt.message}`;

      if (opt.severity === 'high') warn(`  ${line}`);
      else dim(`  ${line}`);
    }
    console.log();
  }

  // Cross-model comparison
  if (result.comparison.length > 0) {
    info('Model Comparison for this project:');
    const compRows = result.comparison.map(c => [
      c.label,
      formatTokens(c.tokens),
      c.costPerLoad < 0.01 ? '< $0.01' : `$${c.costPerLoad.toFixed(4)}`,
      c.headroom,
      c.fits ? '✓' : '⛔',
    ]);
    // Header
    dim('  Model               Tokens    Cost/load   Headroom   Fits?');
    dim('  ─────────────────────────────────────────────────────────────');
    for (const row of compRows) {
      const highlight = row[0].includes(modelName) ? '→ ' : '  ';
      dim(`${highlight}${row[0].padEnd(20)} ${row[1].padStart(8)}   ${row[2].padStart(10)}   ${row[3].padStart(8)}   ${row[4]}`);
    }
    console.log();
  }

  success('Budget analysis complete');
  console.log();
}

function detectProviderForModel(modelName) {
  const resolved = resolveModel(modelName);
  // Simple mapping from family to most likely provider
  const familyToProvider = {
    'anthropic': 'claude',
    'openai-gpt': 'copilot',
    'openai-reasoning': 'codex',
    'gemini': 'gemini',
  };
  return familyToProvider[resolved.family] || 'claude';
}
