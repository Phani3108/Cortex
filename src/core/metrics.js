// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Metrics & Summary Engine — quantifies everything cortex does.
 *
 * Tracks:
 * - Time saved (manual config vs cortex compile)
 * - Token efficiency (how much context budget we use effectively)
 * - Rule evolution (how instructions improve over time)
 * - Provider coverage (how many tools are configured)
 * - Learning velocity (signals captured per session)
 *
 * Generates end-of-project summaries with hard numbers.
 */

import { loadSession } from './session.js';
import { loadConfig } from './config.js';
import { PROVIDER_SPECS } from './specs.js';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getCortexDir } from '../utils/fs.js';

// ── Time Estimates (minutes) ────────────────────────────────────────────────
// Conservative estimates for doing things manually vs cortex.

const MANUAL_ESTIMATES = {
  setupOneProvider: 15,       // Minutes to manually create and format one rule file
  switchProvider: 10,         // Minutes to reformat rules for a different AI tool
  updateAllProviders: 8,      // Minutes per provider to propagate a rule change
  learnFromFeedback: 20,      // Minutes to manually audit AI output and update rules
  onboardTeamMember: 30,      // Minutes to explain all the AI tool configs to someone
  researchProviderFormat: 25, // Minutes to figure out where Kiro/Gemini/etc reads rules
};

const CORTEX_ESTIMATES = {
  setupOneProvider: 0.1,      // Seconds — it's a compile
  switchProvider: 0.1,
  updateAllProviders: 0.1,    // One compile updates all
  learnFromFeedback: 0.5,     // cortex learn is sub-second
  onboardTeamMember: 2,       // git pull + cortex compile
  researchProviderFormat: 0,  // We already know — it's in specs.js
};

/**
 * Calculate what cortex has saved for a project.
 */
export function calculateSavings(projectRoot) {
  const session = loadSession(projectRoot);
  const config = loadConfig(projectRoot);
  const m = session.metrics;

  const enabledProviders = Object.entries(config.providers || {})
    .filter(([, v]) => v).map(([k]) => k);

  const providerCount = enabledProviders.length || 1;

  // Time savings
  const manualSetupMinutes = providerCount * MANUAL_ESTIMATES.setupOneProvider;
  const cortexSetupMinutes = CORTEX_ESTIMATES.setupOneProvider;
  const setupSaved = manualSetupMinutes - cortexSetupMinutes;

  const manualUpdateMinutes = m.compilations * providerCount * MANUAL_ESTIMATES.updateAllProviders;
  const cortexUpdateMinutes = m.compilations * CORTEX_ESTIMATES.updateAllProviders;
  const updateSaved = manualUpdateMinutes - cortexUpdateMinutes;

  const manualLearnMinutes = m.signalsCaptured > 0
    ? Math.ceil(m.signalsCaptured / 5) * MANUAL_ESTIMATES.learnFromFeedback
    : 0;
  const cortexLearnMinutes = m.signalsCaptured > 0
    ? Math.ceil(m.signalsCaptured / 5) * CORTEX_ESTIMATES.learnFromFeedback
    : 0;
  const learnSaved = manualLearnMinutes - cortexLearnMinutes;

  const totalTimeSavedMinutes = setupSaved + updateSaved + learnSaved;

  // Consistency score (0-100)
  const consistencyScore = Math.min(100, Math.round(
    (providerCount / Object.keys(PROVIDER_SPECS).length) * 40 +
    (m.compilations > 0 ? 30 : 0) +
    (m.rulesEvolved > 0 ? 20 : 0) +
    (m.signalsCaptured > 0 ? 10 : 0)
  ));

  // Learning velocity
  const daysSinceStart = session.startedAt
    ? Math.max(1, (Date.now() - new Date(session.startedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 1;
  const signalsPerDay = m.signalsCaptured / daysSinceStart;

  return {
    time: {
      setupSavedMinutes: Math.round(setupSaved),
      updateSavedMinutes: Math.round(updateSaved),
      learnSavedMinutes: Math.round(learnSaved),
      totalSavedMinutes: Math.round(totalTimeSavedMinutes),
      totalSavedHours: +(totalTimeSavedMinutes / 60).toFixed(1),
    },
    coverage: {
      enabledProviders: providerCount,
      totalProviders: Object.keys(PROVIDER_SPECS).length,
      coveragePercent: Math.round((providerCount / Object.keys(PROVIDER_SPECS).length) * 100),
    },
    quality: {
      consistencyScore,
      rulesEvolved: m.rulesEvolved,
      signalsCaptured: m.signalsCaptured,
      signalsPerDay: +signalsPerDay.toFixed(1),
    },
    activity: {
      compilations: m.compilations,
      filesGenerated: m.filesGenerated,
      interactions: session.interactions,
      decisions: session.decisions.length,
      daysSinceStart: Math.round(daysSinceStart),
    },
  };
}

/**
 * Generate a full summary report (end-of-project or on-demand).
 */
export function generateSummary(projectRoot) {
  const savings = calculateSavings(projectRoot);
  const session = loadSession(projectRoot);
  const config = loadConfig(projectRoot);
  const cortexDir = getCortexDir(projectRoot);

  const rulesCount = countFiles(join(cortexDir, 'rules'));
  const skillsCount = countFiles(join(cortexDir, 'skills'));

  const lines = [];

  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║        Cortex — Project Summary                              ║');
  lines.push('║  Created by Phani Marupaka                                    ║');
  lines.push('║  https://github.com/Phani3108/Cortex                          ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Time savings
  lines.push('⏱  TIME SAVINGS');
  lines.push(`   Setup time saved:      ${savings.time.setupSavedMinutes} min`);
  lines.push(`   Update time saved:     ${savings.time.updateSavedMinutes} min`);
  lines.push(`   Learning time saved:   ${savings.time.learnSavedMinutes} min`);
  lines.push(`   ─────────────────────────────`);
  lines.push(`   Total saved:           ${savings.time.totalSavedMinutes} min (${savings.time.totalSavedHours} hrs)`);
  lines.push('');

  // Coverage
  lines.push('🎯 PROVIDER COVERAGE');
  lines.push(`   Providers configured:  ${savings.coverage.enabledProviders} / ${savings.coverage.totalProviders}`);
  lines.push(`   Coverage:              ${savings.coverage.coveragePercent}%`);
  lines.push(`   Files generated:       ${savings.activity.filesGenerated}`);
  lines.push('');

  // Quality
  lines.push('📊 QUALITY METRICS');
  lines.push(`   Consistency score:     ${savings.quality.consistencyScore}/100`);
  lines.push(`   Rules:                 ${rulesCount} active`);
  lines.push(`   Skills:                ${skillsCount} loaded`);
  lines.push(`   Signals captured:      ${savings.quality.signalsCaptured}`);
  lines.push(`   Rules evolved:         ${savings.quality.rulesEvolved}`);
  lines.push(`   Learning velocity:     ${savings.quality.signalsPerDay} signals/day`);
  lines.push('');

  // Activity
  lines.push('📈 ACTIVITY');
  lines.push(`   Compilations:          ${savings.activity.compilations}`);
  lines.push(`   Interactions:          ${savings.activity.interactions}`);
  lines.push(`   Decisions recorded:    ${savings.activity.decisions}`);
  lines.push(`   Days active:           ${savings.activity.daysSinceStart}`);
  lines.push('');

  // Impact statement
  if (savings.time.totalSavedMinutes > 0) {
    lines.push('💡 IMPACT');
    lines.push(`   Without Cortex, maintaining ${savings.coverage.enabledProviders} provider(s) manually`);
    lines.push(`   would have cost ~${savings.time.totalSavedMinutes} minutes of configuration work.`);
    if (savings.quality.signalsCaptured > 0) {
      lines.push(`   ${savings.quality.signalsCaptured} feedback signals were automatically captured and`);
      lines.push(`   distilled into ${savings.quality.rulesEvolved} rule improvements.`);
    }
  }

  return lines.join('\n');
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => !f.startsWith('.')).length;
}

export { MANUAL_ESTIMATES, CORTEX_ESTIMATES };
