// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex hooks — install/remove git hooks for auto-learning.
 */

import { findProjectRoot } from '../utils/fs.js';
import { installHooks, removeHooks, checkHooks } from '../core/hooks.js';
import { heading, info, success, error, dim, table } from '../utils/log.js';

export default async function hooks({ values, positionals }) {
  const subcommand = positionals[0] || 'status';
  const projectRoot = findProjectRoot();

  switch (subcommand) {
    case 'install':
      return doInstall(projectRoot);
    case 'remove':
      return doRemove(projectRoot);
    case 'status':
      return doStatus(projectRoot);
    default:
      error(`Unknown hooks subcommand: ${subcommand} (use install, remove or status)`);
      process.exitCode = 2;
  }
}

function doInstall(projectRoot) {
  heading('Installing git hooks');

  const result = installHooks(projectRoot);
  if (!result.success) {
    error(result.error);
    process.exitCode = 1;
    return;
  }

  for (const hook of result.installed) success(`Installed ${hook} hook`);
  for (const hook of result.updated) success(`Updated ${hook} hook`);
  if (!result.installed.length && !result.updated.length) {
    info('Hooks already installed.');
    return;
  }
  console.log();
  dim('post-commit: auto-learns from AI session artifacts');
  dim('pre-commit: blocks commits when generated context files are stale');
}

function doRemove(projectRoot) {
  heading('Removing git hooks');

  const result = removeHooks(projectRoot);
  if (!result.success) {
    error(result.error);
    process.exitCode = 1;
    return;
  }

  if (result.removed.length === 0) {
    info('No cortex hooks found.');
  } else {
    for (const hook of result.removed) success(`Removed cortex block from ${hook} hook`);
  }
}

function doStatus(projectRoot) {
  heading('Git hook status');

  const result = checkHooks(projectRoot);
  if (result.error) {
    error(result.error);
    process.exitCode = 1;
    return;
  }

  const rows = Object.entries(result.status).map(([hook, state]) => [
    hook,
    state === 'installed' ? '✓ installed' : '○ not installed',
  ]);

  table(rows);
  console.log();
  dim('Install with: cortex hooks install');
}
