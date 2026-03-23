// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex cost — Show estimated token cost analysis for the project.
 */

import { findProjectRoot } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { analyzeProject, estimateCost, getModelCosts, formatBytes, formatTokens } from '../core/tokens.js';
import { heading, info, warn, dim, table } from '../utils/log.js';

export default async function cost({ values }) {
  const projectRoot = findProjectRoot();
  const config = loadConfig(projectRoot);

  heading('Token Cost Analysis');
  info(`Project: ${projectRoot}`);
  console.log();

  const analysis = analyzeProject(projectRoot, config.context || {});

  // Summary
  info('Summary:');
  table([
    ['Text files', `${analysis.textFiles}`],
    ['Binary files', `${analysis.binaryFiles} (excluded)`],
    ['Total size', formatBytes(analysis.totalSize)],
    ['Est. tokens', formatTokens(analysis.totalTokens)],
  ]);

  // By extension
  if (Object.keys(analysis.byExtension).length > 0) {
    console.log();
    info('By file type:');
    const extRows = Object.entries(analysis.byExtension)
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .slice(0, 15)
      .map(([ext, data]) => [
        ext,
        `${data.files} files, ${formatTokens(data.tokens)} tokens (${formatBytes(data.size)})`,
      ]);
    table(extRows);
  }

  // Largest files
  if (analysis.largestFiles.length > 0) {
    console.log();
    info('Largest files:');
    const fileRows = analysis.largestFiles
      .slice(0, 10)
      .map(f => [f.path, `${formatTokens(f.tokens)} tokens (${formatBytes(f.size)})`]);
    table(fileRows);
  }

  // Cost estimates
  console.log();
  info('Estimated cost per full context load:');
  const costs = getModelCosts();
  const costRows = Object.entries(costs)
    .filter(([, c]) => c > 0)
    .map(([model, costPer1M]) => {
      const totalCost = estimateCost(analysis.totalTokens, model);
      return [model, totalCost < 0.01 ? '< $0.01' : `$${totalCost.toFixed(4)}`];
    });
  table(costRows);

  // Max token warning
  const maxTokens = config.context?.max_tokens || 100000;
  if (analysis.totalTokens > maxTokens) {
    console.log();
    warn(`Project exceeds max_tokens limit (${formatTokens(analysis.totalTokens)} > ${formatTokens(maxTokens)})`);
    dim('Consider updating context.exclude in .cortex/config.yaml');
  }

  console.log();
}
