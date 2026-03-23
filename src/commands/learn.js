/**
 * cortex learn — the real learning pipeline.
 *
 * Captures signals from the project, distills them into adaptation plans,
 * and evolves .cortex/ rules — making every AI tool smarter next time.
 *
 * Signal sources:
 * 1. User edits to compiled output files (strongest signal)
 * 2. Project configs (.eslintrc, tsconfig, etc. → implicit rules)
 * 3. Git history (commit patterns, conventional commits, etc.)
 * 4. Code style analysis (semicolons, quotes, etc.)
 * 5. Existing provider rules (reverse-import)
 */

import { existsSync } from 'node:fs';
import { findProjectRoot, getCortexDir } from '../utils/fs.js';
import { captureSignals, SIGNAL_TYPES } from '../core/signals.js';
import { distillSignals, applyAdaptation, loadAdaptationState, saveAdaptationState } from '../core/adapt.js';
import { loadProfile, saveProfile } from '../core/profile.js';
import { heading, info, warn, success, error, dim, table } from '../utils/log.js';

export default async function learn({ values, positionals }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const dry = values.dry;
  const auto = positionals.includes('--auto');
  const quiet = positionals.includes('--quiet');

  if (!quiet) heading('Learning from project signals');

  // Capture all signals
  if (!quiet) info('Scanning for signals...');
  const signalReport = captureSignals(projectRoot);

  if (signalReport.totalSignals === 0) {
    if (!quiet) {
      info('No signals detected.');
      dim('Signals come from: project configs, git history, code style, existing rules');
      dim('Work on the project and run `cortex learn` again.');
    }
    return;
  }

  // Show what we found
  if (!quiet) {
    console.log();
    info(`Captured ${signalReport.totalSignals} signals:`);
    const typeRows = Object.entries(signalReport.byType).map(([type, items]) => [
      formatSignalType(type),
      `${items.length} signal(s)`,
    ]);
    table(typeRows);
  }

  // Distill into adaptation plan
  const plan = distillSignals(signalReport);

  const totalActions = plan.newRules.length + plan.contextUpdates.length +
    plan.importedRules.length + plan.removedRules.length;

  if (totalActions === 0) {
    if (!quiet) info('All signals already captured. Context is up to date.');
    return;
  }

  if (!quiet) {
    console.log();
    info('Adaptation plan:');
    const planRows = [];
    if (plan.contextUpdates.length > 0) planRows.push(['Auto-detected rules', `${plan.contextUpdates.length} from project configs`]);
    if (plan.importedRules.length > 0) planRows.push(['Imported rules', `${plan.importedRules.length} from existing provider files`]);
    if (plan.newRules.length > 0) planRows.push(['User corrections', `${plan.newRules.length} from edited outputs`]);
    if (plan.removedRules.length > 0) planRows.push(['Removed rules', `${plan.removedRules.length} (user rejected)`]);
    table(planRows);
  }

  // Apply adaptations
  if (dry) {
    if (!quiet) {
      console.log();
      info('Dry run — would apply:');
      for (const u of plan.contextUpdates) {
        dim(`+ [${u.category}] ${u.content}`);
      }
      for (const r of plan.importedRules) {
        dim(`+ [imported] ${r.content}`);
      }
      for (const r of plan.newRules) {
        dim(`+ [correction] ${r.content}`);
      }
    }
    return;
  }

  const results = applyAdaptation(projectRoot, plan, { dry });

  // Update adaptation state
  const state = loadAdaptationState(projectRoot);
  state.lastAdapted = new Date().toISOString();
  state.totalCycles = (state.totalCycles || 0) + 1;
  for (const signal of signalReport.signals) {
    state.signalCounts = state.signalCounts || {};
    state.signalCounts[signal.type] = (state.signalCounts[signal.type] || 0) + 1;
  }
  saveAdaptationState(projectRoot, state);

  // Update profile patterns from high-confidence signals
  const profile = loadProfile();
  if (profile._exists) {
    const highConfidence = signalReport.signals
      .filter(s => s.confidence >= 0.9 && s.content.length < 200)
      .map(s => s.content);

    const existingPatterns = new Set(profile.patterns || []);
    const newPatterns = highConfidence.filter(p => !existingPatterns.has(p));

    if (newPatterns.length > 0) {
      profile.patterns = [...(profile.patterns || []), ...newPatterns.slice(0, 20)];
      saveProfile(profile, { force: true });
      if (!quiet) dim(`  Updated profile with ${newPatterns.length} new pattern(s)`);
    }
  }

  if (!quiet) {
    console.log();
    for (const applied of results.applied) {
      success(`${applied.type}: ${applied.count} rule(s) → ${applied.path}`);
    }
    console.log();
    success(`Adaptation cycle #${state.totalCycles} complete`);
    dim('Run `cortex compile` to propagate learned rules to all providers.');
  }
}

function formatSignalType(type) {
  const names = {
    [SIGNAL_TYPES.USER_EDIT]: 'User edits',
    [SIGNAL_TYPES.GIT_PATTERN]: 'Git patterns',
    [SIGNAL_TYPES.PROVIDER_RULE]: 'Provider rules',
    [SIGNAL_TYPES.PROJECT_CONFIG]: 'Project configs',
    [SIGNAL_TYPES.STYLE_SIGNAL]: 'Code style',
    [SIGNAL_TYPES.CORRECTION]: 'Corrections',
  };
  return names[type] || type;
}
