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
import { existsSync, readFileSync } from 'node:fs';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { info, success, dim, warn } from '../utils/log.js';
import { resolveModel } from './families.js';
import { PROVIDER_SPECS } from './specs.js';

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

// Provider config files that may indicate a model switch
const MODEL_CONFIG_FILES = [
  '.vscode/settings.json',
  '.cursor/settings.json',
  '.claude/settings.local.json',
  '.gemini/settings.json',
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
          if (act === 'model_switch' && callbacks.onModelSwitch) callbacks.onModelSwitch();
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

  // Watch model/IDE config files → detect model switches
  for (const file of MODEL_CONFIG_FILES) {
    const fullPath = join(projectRoot, file);
    if (existsSync(fullPath)) {
      try {
        const w = watch(fullPath, () => {
          dim(`  IDE config changed: ${file}`);
          scheduleAction('model_switch');
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

// ── Model Switch Detection ──────────────────────────────────────────────────

// Track last known models per provider config
const _lastKnownModels = new Map();

/**
 * Detect if a model switch happened by reading IDE/provider config files.
 * Returns { changed, from, to } or null.
 */
export function detectModelSwitch(projectRoot) {
  const modelPatterns = [
    // VS Code settings — copilot model
    {
      file: '.vscode/settings.json',
      extract: (content) => {
        try {
          const settings = JSON.parse(content);
          return settings['github.copilot.chat.model']
            || settings['github.copilot.advanced']?.model
            || null;
        } catch { return null; }
      },
    },
    // Cursor settings
    {
      file: '.cursor/settings.json',
      extract: (content) => {
        try {
          const settings = JSON.parse(content);
          return settings.model || settings.defaultModel || null;
        } catch { return null; }
      },
    },
    // Gemini settings
    {
      file: '.gemini/settings.json',
      extract: (content) => {
        try {
          const settings = JSON.parse(content);
          return settings.model || null;
        } catch { return null; }
      },
    },
  ];

  for (const { file, extract } of modelPatterns) {
    const fullPath = join(projectRoot, file);
    if (!existsSync(fullPath)) continue;

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const currentModel = extract(content);
      if (!currentModel) continue;

      const lastModel = _lastKnownModels.get(file);
      _lastKnownModels.set(file, currentModel);

      if (lastModel && lastModel !== currentModel) {
        return { changed: true, from: lastModel, to: currentModel, source: file };
      }
    } catch { /* ignore */ }
  }

  return null;
}
