// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex export — Export your context for sharing or backup.
 */

import { join, basename } from 'node:path';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { findProjectRoot, getCortexDir, walkDir } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { loadProfile } from '../core/profile.js';
import { heading, info, success, error, warn, dim, fileCreated } from '../utils/log.js';

export default async function exportCmd({ values, positionals }) {
  const format = positionals[0] || 'directory'; // directory, json
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const dry = values.dry;

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exitCode = 1;
    return;
  }

  heading('Exporting AI context');

  const config = loadConfig(projectRoot);
  const profile = loadProfile();

  // Gather all content
  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    project: config.project || {},
    config: {
      providers: config.providers,
      context: config.context,
    },
    rules: gatherFiles(join(cortexDir, 'rules')),
    skills: gatherFiles(join(cortexDir, 'skills')),
    profile: profile._exists ? {
      style: profile.style,
      preferences: profile.preferences,
      patterns: profile.patterns,
    } : null,
  };

  if (format === 'json') {
    const outputPath = join(projectRoot, 'cortex-export.json');
    if (dry) {
      info(`Would write: ${outputPath}`);
      info(`Content: ${JSON.stringify(exportData, null, 2).length} bytes`);
    } else {
      writeFileSync(outputPath, JSON.stringify(exportData, null, 2) + '\n', 'utf-8');
      fileCreated(outputPath);
    }
  } else {
    // Export as directory
    const outputDir = join(projectRoot, 'cortex-export');
    if (dry) {
      info(`Would create directory: ${outputDir}`);
    } else {
      mkdirSync(outputDir, { recursive: true });

      // Copy .cortex contents (sources only — not machine-local state)
      for (const file of walkDir(cortexDir).filter(f => isExportable(f.relative))) {
        const dest = join(outputDir, file.relative);
        mkdirSync(join(outputDir, file.relative, '..'), { recursive: true });
        writeFileSync(dest, readFileSync(file.path));
      }

      // Add manifest
      writeFileSync(
        join(outputDir, 'manifest.json'),
        JSON.stringify(exportData, null, 2) + '\n',
        'utf-8'
      );

      fileCreated(outputDir);
    }
  }

  console.log();
  success('Export complete');
  info(`Rules: ${exportData.rules.length}, Skills: ${exportData.skills.length}`);
  dim('Share this export to replicate your AI context on another machine.');
}

// Machine-local state that should never leave the project
const INTERNAL_FILES = new Set(['.compile-manifest.json', 'session.json', 'adaptations.yaml']);
const INTERNAL_DIRS = new Set(['history', '.sync-cache']);

export function isExportable(relPath) {
  const parts = relPath.split(/[\\/]/);
  if (parts.some(p => INTERNAL_DIRS.has(p))) return false;
  return !INTERNAL_FILES.has(parts[parts.length - 1]);
}

/**
 * Collect rule/skill files from a directory. Plain files are taken as-is;
 * subdirectories count only when they hold a SKILL.md (Agent Skills layout).
 */
export function gatherFiles(dir) {
  if (!existsSync(dir)) return [];

  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const skillMd = join(full, 'SKILL.md');
      if (existsSync(skillMd) && statSync(skillMd).isFile()) {
        out.push({ name: entry.name, file: `${entry.name}/SKILL.md`, content: readFileSync(skillMd, 'utf-8') });
      }
    } else if (entry.isFile() && /\.(md|txt)$/.test(entry.name)) {
      out.push({ name: entry.name.replace(/\.(md|txt)$/, ''), file: entry.name, content: readFileSync(full, 'utf-8') });
    }
  }
  return out;
}
