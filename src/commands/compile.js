// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex compile — Compile universal config to provider-specific files.
 */

import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { findProjectRoot, getCortexDir, writeFileSafe } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { loadProfile } from '../core/profile.js';
import { getEnabledProviders } from '../providers/index.js';
import { saveManifest } from '../core/manifest.js';
import { heading, success, info, warn, error, fileCreated, fileSkipped, dryRun, dim, table } from '../utils/log.js';

import { loadSession, saveSession, recordAction, updateMetrics } from '../core/session.js';

export default async function compile({ values, positionals }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const force = values.force;
  const dry = values.dry;
  const targetProvider = values.provider;

  // Check if initialized
  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exit(1);
  }

  heading('Compiling AI context');
  info(`Project: ${projectRoot}`);

  // Load config and profile
  const config = loadConfig(projectRoot);
  const profile = loadProfile();

  // Load rules
  const rules = loadRules(cortexDir);
  const globalRules = loadRules(getCortexDir(null, true));
  const allRules = [...globalRules, ...rules];

  // Load skills
  const skills = loadSkills(cortexDir);
  const globalSkills = loadSkills(getCortexDir(null, true));
  const allSkills = [...globalSkills, ...skills];

  info(`Rules: ${allRules.length} loaded (${globalRules.length} global, ${rules.length} project)`);
  info(`Skills: ${allSkills.length} loaded (${globalSkills.length} global, ${skills.length} project)`);

  // Get enabled providers
  let providers = getEnabledProviders(config);

  // Filter to target provider if specified
  if (targetProvider) {
    if (!providers[targetProvider]) {
      error(`Provider '${targetProvider}' is not enabled in config. Enable it in .cortex/config.yaml`);
      process.exit(1);
    }
    providers = { [targetProvider]: providers[targetProvider] };
  }

  const providerNames = Object.keys(providers);
  if (providerNames.length === 0) {
    warn('No providers enabled. Enable providers in .cortex/config.yaml');
    process.exit(0);
  }

  info(`Providers: ${providerNames.join(', ')}`);
  console.log();

  // Compile for each provider
  let totalFiles = 0;
  const allOutputs = [];
  for (const [name, provider] of Object.entries(providers)) {
    const outputs = provider.compile(projectRoot, config, allRules, allSkills, profile);

    for (const output of outputs) {
      output.provider = name; // Tag for manifest tracking
      if (dry) {
        dryRun(`Would write ${output.path}`);
        totalFiles++;
      } else {
        const created = writeFileSafe(output.path, output.content, { force: true });
        fileCreated(output.path);
        totalFiles++;
        allOutputs.push(output);
      }
    }
  }

  // Save manifest so `learn` can detect user edits later
  if (!dry && allOutputs.length > 0) {
    saveManifest(projectRoot, allOutputs);

    // Track metrics in session
    try {
      const session = loadSession(projectRoot);
      updateMetrics(session, {
        compilations: 1,
        filesGenerated: totalFiles,
        providersUsed: providerNames,
      });
      recordAction(session, 'compiled', { providers: providerNames, files: totalFiles });
      saveSession(session);
    } catch {}
  }

  console.log();
  success(`Compiled ${totalFiles} files for ${providerNames.length} provider(s)`);

  // Show summary
  dim('Provider files are auto-generated. Edit .cortex/ sources instead.');
}

function loadRules(dir) {
  const rulesDir = join(dir, 'rules');
  if (!existsSync(rulesDir)) return [];

  const rules = [];
  for (const file of readdirSync(rulesDir)) {
    if (file.startsWith('.')) continue;
    if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;

    const content = readFileSync(join(rulesDir, file), 'utf-8');

    // Parse markdown into individual rule items
    const items = parseRuleFile(content, file);
    if (items.length > 0) {
      rules.push(...items);
    } else {
      // Fallback: treat entire file as one rule
      rules.push({
        name: file.replace(/\.(md|txt)$/, ''),
        content: content.trim(),
        source: dir,
      });
    }
  }
  return rules;
}

/**
 * Parse a markdown rules file into individual rule items.
 * Extracts bullet points as individual rules, preserves categories from ## headers.
 */
function parseRuleFile(content, fileName) {
  const items = [];
  let currentCategory = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#!') || trimmed.startsWith('<!--')) continue;

    // Track section headers as categories
    if (trimmed.startsWith('## ')) {
      currentCategory = trimmed.slice(3).trim().toLowerCase();
      continue;
    }
    if (trimmed.startsWith('# ')) continue; // Skip h1

    // Extract bullet points as individual rules
    if (trimmed.startsWith('- ') && trimmed.length > 5) {
      items.push({
        name: fileName.replace(/\.(md|txt)$/, ''),
        content: trimmed.slice(2).trim(),
        category: currentCategory || 'rules',
        source: fileName,
      });
    }
  }

  return items;
}

function loadSkills(dir) {
  const skillsDir = join(dir, 'skills');
  if (!existsSync(skillsDir)) return [];

  const skills = [];
  for (const file of readdirSync(skillsDir)) {
    if (file.startsWith('.')) continue;
    if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;

    const content = readFileSync(join(skillsDir, file), 'utf-8');
    skills.push({
      name: file.replace(/\.(md|txt)$/, ''),
      content: content.trim(),
      source: dir,
    });
  }
  return skills;
}
