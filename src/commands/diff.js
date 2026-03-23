// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex diff — Show what changed since last compile.
 *
 * Compares current provider files against the compile manifest to show
 * exactly what the user (or AI) modified after cortex compiled them.
 * This is the "what did you teach it?" view.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { loadManifest } from '../core/manifest.js';
import { heading, info, warn, success, dim, error } from '../utils/log.js';

export default async function diff({ values }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exit(1);
  }

  heading('Changes since last compile');

  const manifest = loadManifest(projectRoot);
  if (!manifest) {
    warn('No compile manifest found. Run `cortex compile` first.');
    return;
  }

  dim(`Last compiled: ${manifest.compiledAt}`);
  console.log();

  let totalChanges = 0;
  let totalAdded = 0;
  let totalRemoved = 0;

  for (const entry of manifest.files || []) {
    if (!existsSync(entry.path)) {
      warn(`  ${basename(entry.path)} — DELETED`);
      totalChanges++;
      continue;
    }

    const current = readFileSync(entry.path, 'utf-8');
    if (current === entry.compiledContent) continue;

    totalChanges++;
    const fileName = basename(entry.path);
    const provider = entry.provider || 'unknown';

    console.log(`\x1b[1m${fileName}\x1b[0m \x1b[2m(${provider})\x1b[0m`);

    // Line-by-line diff
    const origLines = entry.compiledContent.split('\n');
    const currLines = current.split('\n');
    const origSet = new Set(origLines.map(l => l.trim()));
    const currSet = new Set(currLines.map(l => l.trim()));

    // Added lines
    const added = currLines.filter(l => l.trim() && !origSet.has(l.trim()) && l.trim().length > 3);
    // Removed lines
    const removed = origLines.filter(l => l.trim() && !currSet.has(l.trim()) && l.trim().length > 3);

    for (const line of added) {
      console.log(`  \x1b[32m+ ${line.trim()}\x1b[0m`);
      totalAdded++;
    }
    for (const line of removed) {
      console.log(`  \x1b[31m- ${line.trim()}\x1b[0m`);
      totalRemoved++;
    }
    console.log();
  }

  if (totalChanges === 0) {
    success('No changes detected. Provider files match last compile.');
  } else {
    info(`${totalChanges} file(s) modified: +${totalAdded} lines, -${totalRemoved} lines`);
    console.log();
    dim('Run `cortex learn` to capture these edits as rules.');
    dim('Run `cortex compile` to overwrite with latest from .cortex/.');
  }
}
