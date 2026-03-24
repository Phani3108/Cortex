// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex optimize — compress and score rules to maximize token efficiency.
 */

import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { findProjectRoot, getCortexDir, writeFileSafe } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { PROVIDER_SPECS } from '../core/specs.js';
import { scoreRules, generateImpactReport, optimizeForBudget } from '../core/scoring.js';
import { compressRules, needsCompression } from '../core/compress.js';
import { getCharsPerToken } from '../core/families.js';
import { heading, info, success, warn, dim, table, error } from '../utils/log.js';

export default async function optimize({ values, positionals }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const dry = values.dry;
  const providerSlug = values.provider;
  const modelName = values.model;

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exit(1);
  }

  heading('Optimizing rules');
  info(`Project: ${projectRoot}`);

  // Load rules
  const rules = loadRules(cortexDir);
  const globalRules = loadRules(getCortexDir(null, true));
  const allRules = [...globalRules, ...rules];

  if (allRules.length === 0) {
    warn('No rules found. Run `cortex learn` or `cortex add rule` first.');
    process.exit(0);
  }

  info(`Rules loaded: ${allRules.length}`);
  console.log();

  // Determine target model
  const config = loadConfig(projectRoot);
  const targetModel = modelName || getDefaultModel(config, providerSlug);

  // Score all rules
  info('Scoring rules by impact...');
  const scored = scoreRules(allRules, targetModel);
  const report = generateImpactReport(scored);

  // Display impact report
  console.log();
  info('RULE IMPACT ANALYSIS');
  table([
    ['Total rules', `${report.totalRules}`],
    ['Total tokens', `${report.totalTokens}`],
    ['High impact', `${report.tiers.high.count} rules (${report.tiers.high.tokens} tokens)`],
    ['Medium impact', `${report.tiers.medium.count} rules (${report.tiers.medium.tokens} tokens)`],
    ['Low impact', `${report.tiers.low.count} rules (${report.tiers.low.tokens} tokens)`],
  ]);

  // Show top rules
  console.log();
  info('TOP RULES (highest value per token):');
  for (const r of report.topRules.slice(0, 5)) {
    dim(`  [${r.impact.toFixed(3)}] ${r.content} (${r.tokens} tok)`);
  }

  // Show bottom rules
  if (report.bottomRules.length > 0) {
    console.log();
    info('LOWEST IMPACT RULES (candidates for removal):');
    for (const r of report.bottomRules) {
      dim(`  [${r.impact.toFixed(3)}] ${r.content} (${r.tokens} tok)`);
    }
  }

  // Provider-specific compression
  if (providerSlug) {
    const spec = PROVIDER_SPECS[providerSlug];
    if (!spec) {
      error(`Unknown provider: ${providerSlug}`);
      process.exit(1);
    }

    const budget = spec.tokenLimits?.instructionBudget;
    if (budget) {
      console.log();
      info(`Compressing for ${spec.name} (budget: ${budget} tokens)...`);

      if (!needsCompression(allRules, budget, targetModel)) {
        success(`Rules already fit within ${spec.name}'s budget!`);
      } else {
        const { compressed, stats } = compressRules(allRules, budget, targetModel, {
          aggressive: values.force,
        });

        info('COMPRESSION RESULTS');
        table([
          ['Original', `${stats.originalRules} rules, ${stats.originalTokens} tokens`],
          ['Compressed', `${stats.compressedRules} rules, ${stats.compressedTokens} tokens`],
          ['Reduction', `${stats.compressionRatio}%`],
          ['Fits budget', stats.fitsInBudget ? '✓ Yes' : '✗ No'],
        ]);

        for (const step of stats.steps) {
          dim(`  ${step.step}: ${step.removed ? `removed ${step.removed}` : ''} ${step.tokensSaved ? `saved ${step.tokensSaved} tokens` : ''} ${step.note || ''}`);
        }

        if (!stats.fitsInBudget) {
          warn(`Still ${stats.compressedTokens - budget} tokens over budget. Try --force for aggressive compression.`);
        }
      }
    } else {
      info(`${spec.name} has no token budget limit.`);
    }
  } else {
    // Show per-provider fit status
    console.log();
    info('PROVIDER FIT STATUS:');
    const providerRows = [];
    for (const [slug, spec] of Object.entries(PROVIDER_SPECS)) {
      const enabled = config.providers?.[slug];
      if (!enabled) continue;
      const budget = spec.tokenLimits?.instructionBudget;
      if (!budget) {
        providerRows.push([spec.name, 'unlimited', '✓']);
      } else {
        const fits = !needsCompression(allRules, budget, targetModel);
        providerRows.push([spec.name, `${budget} tokens`, fits ? '✓ fits' : `✗ over by ${report.totalTokens - budget}`]);
      }
    }
    if (providerRows.length > 0) table(providerRows);
  }

  console.log();
  success('Optimization analysis complete');
  if (!providerSlug) {
    dim('Run `cortex optimize -p <provider>` to compress for a specific provider');
  }
}

function loadRules(dir) {
  const rulesDir = join(dir, 'rules');
  if (!existsSync(rulesDir)) return [];
  const rules = [];
  for (const file of readdirSync(rulesDir)) {
    if (file.startsWith('.') || (!file.endsWith('.md') && !file.endsWith('.txt'))) continue;
    const content = readFileSync(join(rulesDir, file), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') && trimmed.length > 5) {
        rules.push({ content: trimmed.slice(2).trim(), source: file, category: 'rules' });
      }
    }
  }
  return rules;
}

function getDefaultModel(config, providerSlug) {
  if (providerSlug) {
    const spec = PROVIDER_SPECS[providerSlug];
    if (spec?.models?.[0]) return spec.models[0];
  }
  return 'claude-sonnet-4';
}
