// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex verify — validate compiled output against provider specs.
 */

import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { PROVIDER_SPECS } from '../core/specs.js';
import { getEnabledProviders } from '../providers/index.js';
import { estimateTokens, getTokenFamily } from '../core/tokens.js';
import { generateTips, formatTipsForDisplay } from '../core/tips.js';
import { assessHealth } from '../core/health.js';
import { loadManifest } from '../core/manifest.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';

export default async function verify({ values }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exit(1);
  }

  heading('Verifying compiled output');
  info(`Project: ${projectRoot}`);
  console.log();

  const config = loadConfig(projectRoot);
  const providers = getEnabledProviders(config);
  const providerNames = Object.keys(providers);

  if (providerNames.length === 0) {
    warn('No providers enabled.');
    process.exit(0);
  }

  let totalIssues = 0;
  let totalWarnings = 0;

  for (const [slug, provider] of Object.entries(providers)) {
    const spec = PROVIDER_SPECS[slug];
    if (!spec) continue;

    info(`${spec.name}:`);

    // Check if compiled files exist
    const checks = [];
    for (const cf of spec.contextFiles || []) {
      if (!cf.alwaysLoaded) continue;
      if (cf.path.includes('{') || cf.path.includes('*')) continue;
      if (cf.location !== 'project_root') continue;

      const fullPath = join(projectRoot, cf.path);
      const exists = existsSync(fullPath);

      if (!exists) {
        checks.push({ file: cf.path, status: 'missing', issue: 'File not found' });
        totalIssues++;
        continue;
      }

      const content = readFileSync(fullPath, 'utf-8');
      const family = getTokenFamily(spec.models?.[0] || 'gpt-4o');
      const tokens = estimateTokens(content, family);
      const budget = spec.tokenLimits?.instructionBudget;

      // Size check
      if (budget && tokens > budget) {
        checks.push({
          file: cf.path,
          status: 'warning',
          issue: `${tokens} tokens exceeds budget of ${budget}`,
          tokens,
        });
        totalWarnings++;
      } else if (content.trim().length === 0) {
        checks.push({ file: cf.path, status: 'warning', issue: 'File is empty', tokens: 0 });
        totalWarnings++;
      } else {
        checks.push({ file: cf.path, status: 'ok', tokens });
      }

      // Character limit check
      if (cf.maxSize && content.length > cf.maxSize) {
        checks.push({
          file: cf.path,
          status: 'warning',
          issue: `${content.length} chars exceeds limit of ${cf.maxSize}`,
        });
        totalWarnings++;
      }
    }

    // Display results
    for (const check of checks) {
      const icon = check.status === 'ok' ? '  ✓' : check.status === 'warning' ? '  ⚠' : '  ✗';
      const detail = check.tokens !== undefined ? ` (${check.tokens} tokens)` : '';
      const issue = check.issue ? ` — ${check.issue}` : '';

      if (check.status === 'ok') {
        success(`${icon} ${check.file}${detail}`);
      } else if (check.status === 'warning') {
        warn(`${icon} ${check.file}${detail}${issue}`);
      } else {
        error(`${icon} ${check.file}${issue}`);
      }
    }

    // Generate model-specific tips for this provider
    const primaryFile = spec.contextFiles?.find(f => f.alwaysLoaded && !f.deprecated && f.location === 'project_root');
    if (primaryFile) {
      const primaryPath = join(projectRoot, primaryFile.path);
      if (existsSync(primaryPath) && !primaryFile.path.includes('{')) {
        const content = readFileSync(primaryPath, 'utf-8');
        const model = spec.models?.[0] || 'gpt-4o';
        const tips = generateTips(content, model, slug);

        const criticalTips = tips.filter(t => t.severity === 'critical');
        const warningTips = tips.filter(t => t.severity === 'warning');

        if (criticalTips.length > 0 || warningTips.length > 0) {
          const tipsDisplay = formatTipsForDisplay([...criticalTips, ...warningTips]);
          if (tipsDisplay) console.log(tipsDisplay);
          totalWarnings += warningTips.length;
          totalIssues += criticalTips.length;
        }
      }
    }

    console.log();
  }

  // Manifest freshness
  const manifest = loadManifest(projectRoot);
  if (manifest) {
    const age = Date.now() - new Date(manifest.compiledAt).getTime();
    const ageHours = Math.floor(age / (1000 * 60 * 60));
    if (ageHours > 24) {
      warn(`Last compiled ${ageHours} hours ago. Consider re-compiling.`);
    } else {
      dim(`  Last compiled: ${ageHours}h ago`);
    }
  } else {
    warn('No compile manifest found. Run `cortex compile` first.');
    totalIssues++;
  }

  // Health summary
  const health = assessHealth(projectRoot, config);
  console.log();
  info(`Overall health: ${health.overall.score}/100 (${health.overall.label})`);

  if (health.recommendations.length > 0) {
    console.log();
    info('Recommendations:');
    for (const rec of health.recommendations) {
      dim(`  ${rec.priority === 'high' ? '!' : '·'} ${rec.message}`);
    }
  }

  // Summary
  console.log();
  if (totalIssues === 0 && totalWarnings === 0) {
    success('All checks passed!');
  } else if (totalIssues === 0) {
    success(`Passed with ${totalWarnings} warning(s).`);
  } else {
    error(`${totalIssues} issue(s) and ${totalWarnings} warning(s) found.`);
  }
}
