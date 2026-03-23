// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Configuration loading and management.
 * Handles .cortex/config.yaml for project-level and global configs.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parse, stringify } from '../utils/yaml.js';
import { readFileSafe, writeFileSafe, getCortexDir } from '../utils/fs.js';

const CONFIG_FILE = 'config.yaml';

const DEFAULT_CONFIG = {
  version: 1,
  project: {
    name: null,
    language: null,
    framework: null,
  },
  providers: {
    claude: true,
    cursor: true,
    copilot: true,
    windsurf: false,
    antigravity: false,
    codex: false,
    gemini: false,
    openai: false,
  },
  rules: {
    sources: ['local'],
  },
  skills: {
    sources: ['local'],
  },
  context: {
    include: ['src/', 'lib/', 'app/', 'packages/'],
    exclude: ['node_modules/', 'dist/', 'build/', '.git/', '*.lock'],
    max_tokens: 100000,
  },
};

/**
 * Load config from .cortex/config.yaml.
 * Merges with defaults for missing keys.
 */
export function loadConfig(projectRoot, global = false) {
  const dir = getCortexDir(projectRoot, global);
  const configPath = join(dir, CONFIG_FILE);
  const raw = readFileSafe(configPath);

  if (!raw) return { ...DEFAULT_CONFIG, _path: configPath, _exists: false };

  const parsed = parse(raw);
  return deepMerge(DEFAULT_CONFIG, parsed, { _path: configPath, _exists: true });
}

/**
 * Save config to .cortex/config.yaml.
 */
export function saveConfig(config, opts = {}) {
  const { _path, _exists, ...data } = config;
  const content = `# cortex configuration\n# https://github.com/YOUR_USERNAME/cortex\n\n${stringify(data)}\n`;
  return writeFileSafe(_path, content, opts);
}

/**
 * Get the default config template as a string.
 */
export function getDefaultConfigString(overrides = {}) {
  const config = deepMerge(DEFAULT_CONFIG, overrides);
  return `# cortex configuration
# https://github.com/YOUR_USERNAME/cortex

${stringify(config)}
`;
}

export { DEFAULT_CONFIG };

function deepMerge(target, ...sources) {
  const result = { ...target };
  for (const source of sources) {
    if (!source) continue;
    for (const [key, val] of Object.entries(source)) {
      if (val && typeof val === 'object' && !Array.isArray(val) &&
          result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key], val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}
