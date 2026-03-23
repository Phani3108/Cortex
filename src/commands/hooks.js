/**
 * cortex hooks — install/remove git hooks for auto-learning.
 */

import { findProjectRoot } from '../utils/fs.js';
import { installHooks, removeHooks, checkHooks } from '../core/hooks.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';

export default async function hooks({ values, positionals }) {
  const subcommand = positionals[0] || 'status';
  const projectRoot = findProjectRoot();

  switch (subcommand) {
    case 'install':
      return doInstall(projectRoot);
    case 'remove':
      return doRemove(projectRoot);
    case 'status':
    default:
      return doStatus(projectRoot);
  }
}

function doInstall(projectRoot) {
  heading('Installing git hooks');

  const result = installHooks(projectRoot);

  if (!result.success) {
    error(result.error);
    return;
  }

  if (result.installed.length === 0) {
    info('Hooks already installed.');
  } else {
    for (const hook of result.installed) {
      success(`Installed ${hook} hook`);
    }
    console.log();
    dim('post-commit: auto-learns from AI session artifacts');
    dim('pre-commit: re-compiles if .cortex/ sources changed');
  }
}

function doRemove(projectRoot) {
  heading('Removing git hooks');

  const result = removeHooks(projectRoot);

  if (result.removed.length === 0) {
    info('No cortex hooks found.');
  } else {
    for (const hook of result.removed) {
      success(`Removed ${hook} hook`);
    }
  }
}

function doStatus(projectRoot) {
  heading('Git hook status');

  const status = checkHooks(projectRoot);

  const rows = Object.entries(status).map(([hook, state]) => [
    hook,
    state === 'installed' ? '✓ installed' : '○ not installed',
  ]);

  table(rows);
  console.log();
  dim('Install with: cortex hooks install');
}
