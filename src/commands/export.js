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
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
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
    process.exit(1);
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

      // Copy .cortex contents
      for (const file of walkDir(cortexDir)) {
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

function gatherFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter(f => !f.startsWith('.'))
    .map(f => ({
      name: f.replace(/\.(md|txt)$/, ''),
      file: f,
      content: readFileSync(join(dir, f), 'utf-8'),
    }));
}
