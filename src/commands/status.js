// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex status — Show current cortex configuration status.
 */

import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { loadProfile } from '../core/profile.js';
import { getAllProviders } from '../providers/index.js';
import { heading, info, warn, dim, table, success } from '../utils/log.js';
import { assessHealth } from '../core/health.js';
import { isRegistryStale, getRegistryStaleness } from '../core/registry.js';

export default async function status({ values }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const globalDir = getCortexDir(null, true);

  heading('cortex Status');

  // Project
  console.log();
  info(`Project root: ${projectRoot}`);

  if (existsSync(cortexDir)) {
    success('Project initialized (.cortex/ exists)');
  } else {
    warn('Project not initialized. Run `cortex init`');
  }

  // Global
  if (existsSync(globalDir)) {
    success('Global profile exists (~/.cortex/)');
  } else {
    dim('No global profile. Run `cortex init --global`');
  }

  // Config
  if (existsSync(cortexDir)) {
    const config = loadConfig(projectRoot);
    console.log();
    info('Configuration:');
    const rows = [];
    if (config.project?.name) rows.push(['Project', config.project.name]);
    if (config.project?.language) rows.push(['Language', config.project.language]);
    if (config.project?.framework) rows.push(['Framework', config.project.framework]);
    if (config.context?.max_tokens) rows.push(['Max tokens', String(config.context.max_tokens)]);
    if (rows.length > 0) table(rows);

    // Providers
    console.log();
    info('Providers:');
    const providers = getAllProviders();
    const providerRows = [];
    for (const [key, provider] of Object.entries(providers)) {
      const enabled = config.providers?.[key] ?? false;
      const detected = provider.detect(projectRoot);
      const status = enabled
        ? (detected ? '✓ enabled (files exist)' : '✓ enabled (not compiled)')
        : '○ disabled';
      providerRows.push([provider.name, status]);
    }
    table(providerRows);

    // Rules & Skills
    console.log();
    const rulesDir = join(cortexDir, 'rules');
    const skillsDir = join(cortexDir, 'skills');
    const ruleCount = countFiles(rulesDir);
    const skillCount = countFiles(skillsDir);
    const globalRuleCount = countFiles(join(globalDir, 'rules'));
    const globalSkillCount = countFiles(join(globalDir, 'skills'));

    info('Content:');
    table([
      ['Project rules', `${ruleCount} file(s)`],
      ['Project skills', `${skillCount} file(s)`],
      ['Global rules', `${globalRuleCount} file(s)`],
      ['Global skills', `${globalSkillCount} file(s)`],
    ]);
  }

  // Profile
  const profile = loadProfile();
  if (profile._exists) {
    console.log();
    info('Profile:');
    const profileRows = [];
    if (profile.name) profileRows.push(['Name', profile.name]);
    if (profile.style?.tone) profileRows.push(['Tone', profile.style.tone]);
    if (profile.style?.verbosity) profileRows.push(['Verbosity', profile.style.verbosity]);
    if (profile.patterns?.length) profileRows.push(['Patterns', `${profile.patterns.length} stored`]);
    if (profileRows.length > 0) table(profileRows);
  }

  // Provider Health
  if (existsSync(cortexDir)) {
    const config = loadConfig(projectRoot);
    const health = assessHealth(projectRoot, config);

    console.log();
    info(`Health: ${health.overall.score}/100 (${health.overall.label})`);

    // Registry status
    const staleDays = getRegistryStaleness();
    const registryLabel = staleDays === Infinity ? 'never synced'
      : staleDays > 7 ? `stale (${staleDays} days old)`
      : `current (${staleDays}d ago)`;
    dim(`  Registry: ${registryLabel}`);

    // Per-provider health
    for (const [slug, ph] of Object.entries(health.providers)) {
      const icon = ph.status === 'healthy' ? '✓' : ph.status === 'warning' ? '⚠' : '✗';
      dim(`  ${icon} ${ph.name}: ${ph.status}${ph.newModels.length > 0 ? ` (+${ph.newModels.length} new model${ph.newModels.length > 1 ? 's' : ''})` : ''}`);
    }

    // Recommendations
    if (health.recommendations.length > 0) {
      console.log();
      info('Recommendations:');
      for (const rec of health.recommendations.slice(0, 3)) {
        dim(`  ${rec.priority === 'high' ? '!' : '·'} ${rec.message}`);
      }
    }
  }

  console.log();
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => !f.startsWith('.')).length;
}
