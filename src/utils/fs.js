// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * File system helpers.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * Write a file, creating parent directories as needed.
 * Returns true if the file was created, false if skipped (exists & no force).
 */
export function writeFileSafe(filePath, content, { force = false, dry = false } = {}) {
  if (existsSync(filePath) && !force) return false;
  if (dry) return true;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
  return true;
}

/**
 * Read a file as text. Returns null if it doesn't exist.
 */
export function readFileSafe(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf-8');
}

/**
 * Recursively list all files under a directory.
 */
export function walkDir(dir, base = dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip common ignore dirs
      if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) continue;
      results.push(...walkDir(fullPath, base));
    } else {
      results.push({
        path: fullPath,
        relative: relative(base, fullPath),
        size: statSync(fullPath).size,
      });
    }
  }
  return results;
}

/**
 * Get the .cortex directory path for a project or globally.
 */
export function getCortexDir(projectRoot, global = false) {
  if (global) {
    const home = process.env.HOME || process.env.USERPROFILE;
    return join(home, '.cortex');
  }
  return join(projectRoot, '.cortex');
}

/**
 * Detect the project root by walking up looking for common markers.
 */
export function findProjectRoot(startDir = process.cwd()) {
  const markers = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', '.git', 'Gemfile', 'pom.xml'];
  let dir = startDir;

  while (dir !== dirname(dir)) {
    for (const marker of markers) {
      if (existsSync(join(dir, marker))) return dir;
    }
    dir = dirname(dir);
  }

  return startDir; // Fallback to current dir
}
