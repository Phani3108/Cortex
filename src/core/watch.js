// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Watch Mode — continuously adapt as user works.
 *
 * Watches for changes to:
 * - .cortex/ sources → triggers recompile
 * - Provider output files → detects user edits → triggers learn
 * - Project configs → detects new tools/frameworks
 *
 * This makes cortex feel "alive" — it notices when you change things
 * and keeps everything in sync automatically.
 */

import { watch } from 'node:fs';
import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { info, success, dim, warn } from '../utils/log.js';

const DEBOUNCE_MS = 2000; // Wait 2s after last change before acting
const PROVIDER_FILES = [
  'CLAUDE.md', '.cursorrules', '.windsurfrules', 'AGENTS.md',
  '.github/copilot-instructions.md',
];
const SOURCE_DIRS = ['rules', 'skills'];
const CONFIG_FILES = [
  'package.json', 'tsconfig.json', 'pyproject.toml',
  '.eslintrc.json', '.prettierrc',
];

/**
 * Start watching a project for changes.
 */
export function startWatch(projectRoot, callbacks = {}) {
  const cortexDir = getCortexDir(projectRoot);
  const watchers = [];
  let debounceTimer = null;
  let pendingActions = new Set();

  const scheduleAction = (action) => {
    pendingActions.add(action);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const actions = [...pendingActions];
      pendingActions.clear();
      for (const act of actions) {
        try {
          if (act === 'compile' && callbacks.onCompile) callbacks.onCompile();
          if (act === 'learn' && callbacks.onLearn) callbacks.onLearn();
          if (act === 'detect' && callbacks.onDetect) callbacks.onDetect();
        } catch (err) {
          if (callbacks.onError) callbacks.onError(err);
        }
      }
    }, DEBOUNCE_MS);
  };

  // Watch .cortex/ sources → recompile
  for (const subDir of SOURCE_DIRS) {
    const watchPath = join(cortexDir, subDir);
    if (existsSync(watchPath)) {
      try {
        const w = watch(watchPath, { recursive: true }, (event, filename) => {
          if (filename && !filename.startsWith('.')) {
            dim(`  Source changed: ${subDir}/${filename}`);
            scheduleAction('compile');
          }
        });
        watchers.push(w);
      } catch { /* fs.watch not supported recursively on all platforms */ }
    }
  }

  // Watch .cortex/config.yaml → recompile
  const configPath = join(cortexDir, 'config.yaml');
  if (existsSync(configPath)) {
    try {
      const w = watch(configPath, () => {
        dim('  Config changed');
        scheduleAction('compile');
      });
      watchers.push(w);
    } catch { /* ignore */ }
  }

  // Watch provider output files → detect user edits
  for (const file of PROVIDER_FILES) {
    const fullPath = join(projectRoot, file);
    if (existsSync(fullPath)) {
      try {
        const w = watch(fullPath, () => {
          dim(`  Provider file edited: ${file}`);
          scheduleAction('learn');
        });
        watchers.push(w);
      } catch { /* ignore */ }
    }
  }

  // Watch project configs → detect new tools/frameworks
  for (const file of CONFIG_FILES) {
    const fullPath = join(projectRoot, file);
    if (existsSync(fullPath)) {
      try {
        const w = watch(fullPath, () => {
          dim(`  Project config changed: ${file}`);
          scheduleAction('detect');
        });
        watchers.push(w);
      } catch { /* ignore */ }
    }
  }

  return {
    watcherCount: watchers.length,
    stop() {
      clearTimeout(debounceTimer);
      for (const w of watchers) {
        try { w.close(); } catch { /* ignore */ }
      }
    },
  };
}
