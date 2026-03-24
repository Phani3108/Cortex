// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex watch — continuously adapt as you work.
 */

import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { startWatch, detectModelSwitch } from '../core/watch.js';
import { captureSignals } from '../core/signals.js';
import { distillSignals, applyAdaptation } from '../core/adapt.js';
import { heading, info, success, dim, warn } from '../utils/log.js';
import { existsSync } from 'node:fs';
import { compareModels } from '../core/compare.js';

export default async function watch({ values }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);

  if (!existsSync(cortexDir)) {
    warn('.cortex/ not found. Run `cortex init` first.');
    process.exit(1);
  }

  heading('Watching for changes');
  info(`Project: ${projectRoot}`);
  console.log();

  const { default: compileCmd } = await import('./compile.js');
  const { default: learnCmd } = await import('./learn.js');

  const watcher = startWatch(projectRoot, {
    onCompile: () => {
      info('Re-compiling...');
      compileCmd({ values: { ...values, force: true }, positionals: [] }).catch(() => {});
    },
    onLearn: () => {
      info('Detected edits — learning...');
      learnCmd({ values, positionals: ['--quiet'] }).catch(() => {});
    },
    onDetect: () => {
      info('Project config changed — re-scanning...');
      const report = captureSignals(projectRoot);
      if (report.totalSignals > 0) {
        const plan = distillSignals(report);
        if (plan.contextUpdates.length > 0) {
          applyAdaptation(projectRoot, plan);
          dim(`  Updated ${plan.contextUpdates.length} auto-detected rule(s)`);
        }
      }
    },
    onError: (err) => {
      dim(`  Error: ${err.message}`);
    },
    onModelSwitch: () => {
      info('Model/IDE config changed — checking for model switch...');
      try {
        const result = detectModelSwitch(projectRoot);
        if (result && result.changed) {
          info(`  Model switch detected: ${result.from} → ${result.to}`);
          const comparison = compareModels(result.from, result.to);
          if (comparison.recompileNeeded) {
            warn(`  Format change required. Re-compiling...`);
            compileCmd({ values: { ...values, force: true }, positionals: [] }).catch(() => {});
          } else {
            dim(`  Same format family — no recompile needed.`);
          }
          if (comparison.costDelta.direction !== 'same') {
            dim(`  Cost impact: ${comparison.costDelta.change}`);
          }
        }
      } catch { /* ignore detection errors */ }
    },
  });

  info(`Watching ${watcher.watcherCount} paths`);
  dim('Press Ctrl+C to stop');
  console.log();

  // Keep process alive
  process.on('SIGINT', () => {
    console.log();
    watcher.stop();
    success('Stopped watching');
    process.exit(0);
  });

  // Prevent exit
  await new Promise(() => {});
}
