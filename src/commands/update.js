// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex update — Check for updates and refresh upstream sources.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { heading, info, success, dim, warn, error } from '../utils/log.js';

export default async function update({ values }) {
  heading('Updating cortex');

  // Get current version from our package.json
  const currentVersion = getCurrentVersion();
  info(`Current version: ${currentVersion}`);

  // Check npm for latest version
  info('Checking npm registry...');
  const latest = checkNpmVersion();

  if (latest) {
    if (latest === currentVersion) {
      success('You are running the latest version.');
    } else if (isNewer(latest, currentVersion)) {
      console.log();
      warn(`Update available: ${currentVersion} → ${latest}`);
      info('Run the following to update:');
      dim('  npm update -g cortex');
      console.log();
    } else {
      success(`You are running a newer version than published (${currentVersion} > ${latest}).`);
    }
  } else {
    dim('Could not check npm registry (offline or not published yet).');
    dim('Run `npm update -g cortex` to update manually.');
  }

  // If in a project, also sync upstream sources
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);

  if (existsSync(cortexDir)) {
    const config = loadConfig(projectRoot);
    const ruleSources = config.rules?.sources || [];
    const skillSources = config.skills?.sources || [];

    const remoteSources = [...ruleSources, ...skillSources].filter(
      s => s !== 'local' && (s.startsWith('http://') || s.startsWith('https://'))
    );

    if (remoteSources.length > 0) {
      console.log();
      info(`Found ${remoteSources.length} remote source(s). Running sync...`);
      // Dynamically import and run sync
      try {
        const syncModule = await import('./sync.js');
        await syncModule.default({ values: { dry: values.dry } });
      } catch (err) {
        warn(`Sync failed: ${err.message}`);
      }
    }
  }

  console.log();
  success('Update check complete');
}

function getCurrentVersion() {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function checkNpmVersion() {
  try {
    const result = execSync('npm view cortex version 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    // Validate it looks like a semver
    if (/^\d+\.\d+\.\d+/.test(result)) return result;
    return null;
  } catch {
    return null;
  }
}

/**
 * Compare semver strings: is `a` newer than `b`?
 */
function isNewer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}
