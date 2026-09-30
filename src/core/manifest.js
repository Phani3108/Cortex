// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Compile manifest — what Cortex wrote, so it can:
 *   - refuse to overwrite files a human edited since the last compile,
 *   - delete files it generated earlier but no longer produces,
 *   - let `cortex learn` turn hand edits into rules.
 *
 * Stored at .cortex/.compile-manifest.json (git-ignored, machine-local).
 * v2 stores project-relative paths + content hashes; `path` is re-derived as
 * an absolute path on load so older consumers keep working.
 */

import { join, isAbsolute, relative } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getCortexDir, writeFileSafe } from '../utils/fs.js';

const MANIFEST_FILE = '.compile-manifest.json';

export function hashContent(content) {
  return createHash('sha256').update(String(content)).digest('hex').slice(0, 16);
}

/**
 * Save the manifest. Entries for targets that were not part of this compile
 * are kept, so `cortex compile -p cursor` doesn't forget CLAUDE.md.
 *
 * @param {string} projectRoot
 * @param {Array<{path, content, target?, targets?, provider?}>} outputs - paths relative or absolute
 * @param {object} [opts] - { compiledTargets: string[] } targets fully recompiled this run
 */
export function saveManifest(projectRoot, outputs, opts = {}) {
  const previous = loadManifest(projectRoot);
  const recompiled = new Set(opts.compiledTargets || outputs.flatMap(o => o.targets || [o.target || o.provider]));
  const files = new Map();

  for (const entry of previous?.files || []) {
    const owners = entry.targets || [entry.provider];
    if (owners.some(t => recompiled.has(t))) continue;
    files.set(entry.file, stripAbsolute(entry));
  }
  for (const o of outputs) {
    const file = toRelative(projectRoot, o.path);
    const targets = o.targets || [o.target || o.provider || 'unknown'];
    files.set(file, {
      file,
      provider: targets[0],
      targets,
      kind: o.kind || 'instructions',
      hash: hashContent(o.content),
      size: o.content.length,
      compiledContent: o.content,
    });
  }

  const manifest = {
    version: 2,
    compiledAt: new Date().toISOString(),
    files: [...files.values()].map(e => ({ ...e, path: join(projectRoot, e.file) })),
  };
  writeFileSafe(join(getCortexDir(projectRoot), MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', { force: true });
  return manifest;
}

/** Load the manifest, upgrading v1 (absolute paths) entries in memory. */
export function loadManifest(projectRoot) {
  const manifestPath = join(getCortexDir(projectRoot), MANIFEST_FILE);
  if (!existsSync(manifestPath)) return null;
  let raw;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
  const files = (raw.files || []).map(entry => {
    const file = entry.file || toRelative(projectRoot, entry.path || '');
    const compiledContent = entry.compiledContent ?? '';
    return {
      ...entry,
      file,
      path: join(projectRoot, file),
      targets: entry.targets || [entry.provider],
      hash: entry.hash || hashContent(compiledContent),
      compiledContent,
    };
  });
  return { ...raw, files };
}

/** Manifest entry for a project-relative path, or null. */
export function manifestEntry(manifest, file) {
  return manifest?.files?.find(e => e.file === file) || null;
}

/** Generated files a human has edited since the last compile. */
export function detectUserEdits(projectRoot) {
  const manifest = loadManifest(projectRoot);
  if (!manifest) return [];
  const edits = [];
  for (const entry of manifest.files) {
    if (!existsSync(entry.path)) continue;
    const current = readFileSync(entry.path, 'utf-8');
    if (hashContent(current) !== entry.hash) {
      edits.push({
        path: entry.path,
        file: entry.file,
        provider: entry.provider,
        originalSize: entry.size,
        currentSize: current.length,
        compiledAt: manifest.compiledAt,
      });
    }
  }
  return edits;
}

function toRelative(projectRoot, p) {
  if (!p) return p;
  return (isAbsolute(p) ? relative(projectRoot, p) : p).split('\\').join('/');
}

function stripAbsolute(entry) {
  const { path, ...rest } = entry;
  return rest;
}
