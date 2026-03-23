/**
 * Compile Manifest — tracks what was compiled so we can detect user edits.
 *
 * After every compile, we save a manifest of:
 * - What files were written
 * - What content was in them
 * - When they were compiled
 *
 * On the next `learn` cycle, we compare current file content to manifest
 * to detect user corrections (the strongest learning signal).
 */

import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { getCortexDir, writeFileSafe } from '../utils/fs.js';

const MANIFEST_FILE = '.compile-manifest.json';

/**
 * Save a compile manifest after compilation.
 */
export function saveManifest(projectRoot, outputs) {
  const cortexDir = getCortexDir(projectRoot);
  const manifestPath = join(cortexDir, MANIFEST_FILE);

  const manifest = {
    compiledAt: new Date().toISOString(),
    version: 1,
    files: outputs.map(o => ({
      path: o.path,
      provider: o.provider || 'unknown',
      compiledContent: o.content,
      size: o.content.length,
    })),
  };

  writeFileSafe(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { force: true });
  return manifest;
}

/**
 * Load the last compile manifest.
 */
export function loadManifest(projectRoot) {
  const cortexDir = getCortexDir(projectRoot);
  const manifestPath = join(cortexDir, MANIFEST_FILE);

  if (!existsSync(manifestPath)) return null;

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Check which compiled files have been modified by the user.
 */
export function detectUserEdits(projectRoot) {
  const manifest = loadManifest(projectRoot);
  if (!manifest) return [];

  const edits = [];
  for (const entry of manifest.files) {
    if (!existsSync(entry.path)) continue;

    const current = readFileSync(entry.path, 'utf-8');
    if (current !== entry.compiledContent) {
      edits.push({
        path: entry.path,
        provider: entry.provider,
        originalSize: entry.size,
        currentSize: current.length,
        compiledAt: manifest.compiledAt,
      });
    }
  }

  return edits;
}
