// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * User profile management.
 * Handles ~/.cortex/profile.yaml — personal preferences carried across projects.
 */

import { join } from 'node:path';
import { parse, stringify } from '../utils/yaml.js';
import { readFileSafe, writeFileSafe, getCortexDir } from '../utils/fs.js';

const PROFILE_FILE = 'profile.yaml';

const DEFAULT_PROFILE = {
  name: null,
  style: {
    tone: 'concise',
    verbosity: 'normal',
    comments: 'minimal',
    language: 'en',
  },
  preferences: {
    typescript: false,
    testing_framework: null,
    formatter: null,
    linter: null,
  },
  patterns: [],
  learned: [],
};

/**
 * Load the user's global profile.
 */
export function loadProfile() {
  const dir = getCortexDir(null, true);
  const profilePath = join(dir, PROFILE_FILE);
  const raw = readFileSafe(profilePath);

  if (!raw) return { ...DEFAULT_PROFILE, _path: profilePath, _exists: false };

  const parsed = parse(raw);
  return { ...DEFAULT_PROFILE, ...parsed, _path: profilePath, _exists: true };
}

/**
 * Save the user's global profile.
 */
export function saveProfile(profile, opts = {}) {
  const { _path, _exists, ...data } = profile;
  const content = `# cortex user profile
# Personal preferences carried across all projects

${stringify(data)}
`;
  return writeFileSafe(_path, content, opts);
}

/**
 * Get the default profile as a string.
 */
export function getDefaultProfileString() {
  return `# cortex user profile
# Personal preferences carried across all projects
#
# This file lives at ~/.cortex/profile.yaml and is merged
# into every project's AI context when you compile.

${stringify(DEFAULT_PROFILE)}
`;
}

export { DEFAULT_PROFILE };
