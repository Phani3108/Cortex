// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * .cortex/config.yaml — loading, defaults and serialisation.
 *
 *   providers:            # which tools to compile for (true/false or { enabled, model })
 *     claude: true
 *     cursor: { enabled: true, model: gpt-6.1-sol }   # format for this model family
 *   output:
 *     agentsMd: shared    # shared: tools that read AGENTS.md don't get a duplicate copy
 *     skills: true        # emit .cortex/skills as Agent Skills (SKILL.md)
 */

import { join } from 'node:path';
import { parse, stringify } from '../utils/yaml.js';
import { readFileSafe, writeFileSafe, getCortexDir } from '../utils/fs.js';
import { TARGET_IDS, DEFAULT_TARGETS } from '../engine/targets.js';

const CONFIG_FILE = 'config.yaml';
const HEADER = `# Cortex configuration — https://github.com/Phani3108/Cortex
# Docs: https://cortex1.vercel.app/docs.html#config
`;

const DEFAULT_CONFIG = {
  version: 2,
  project: {
    name: null,
    language: null,
    framework: null,
  },
  providers: Object.fromEntries(TARGET_IDS.map(id => [id, DEFAULT_TARGETS.includes(id)])),
  output: {
    agentsMd: 'shared',
    skills: true,
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
 * Load config from .cortex/config.yaml, merged over defaults.
 * Provider keys missing from the file default to disabled (so adding a new
 * target to Cortex never silently enables it in existing projects).
 */
export function loadConfig(projectRoot, global = false) {
  const dir = getCortexDir(projectRoot, global);
  const configPath = join(dir, CONFIG_FILE);
  const raw = readFileSafe(configPath);

  if (!raw) return { ...structuredClone(DEFAULT_CONFIG), _path: configPath, _exists: false };

  let parsed = {};
  try {
    parsed = parse(raw) || {};
  } catch (err) {
    throw new Error(`Could not parse ${configPath}: ${err.message}`);
  }
  const base = structuredClone(DEFAULT_CONFIG);
  base.providers = Object.fromEntries(TARGET_IDS.map(id => [id, false]));
  return deepMerge(base, parsed, { _path: configPath, _exists: true });
}

/** Save config to .cortex/config.yaml. */
export function saveConfig(config, opts = {}) {
  const { _path, _exists, ...data } = config;
  return writeFileSafe(_path, `${HEADER}\n${stringify(data)}\n`, opts);
}

/** Default config as YAML text, with overrides applied. */
export function getDefaultConfigString(overrides = {}) {
  const config = deepMerge(structuredClone(DEFAULT_CONFIG), overrides);
  return `${HEADER}\n${stringify(config)}\n`;
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
