// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex switch — Show what changes when switching between LLM models.
 *
 * Usage:
 *   cortex switch claude-sonnet-4 gpt-5.1
 *   cortex switch gemini-2.5-pro claude-sonnet-4.6
 */

import { findProjectRoot } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { compareModels } from '../core/compare.js';
import { resolveModel } from '../core/families.js';
import { analyzeProject, formatTokens } from '../core/tokens.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';

export default async function switchCmd({ positionals }) {
  const fromModel = positionals[0];
  const toModel = positionals[1];

  if (!fromModel || !toModel) {
    error('Usage: cortex switch <from-model> <to-model>');
    dim('  Example: cortex switch claude-sonnet-4 gpt-5.1');
    dim('  Example: cortex switch gemini-2.5-pro claude-sonnet-4.6');
    process.exit(1);
  }

  // Validate both models resolve to known families
  const fromResolved = resolveModel(fromModel);
  const toResolved = resolveModel(toModel);

  if (fromResolved.family === 'unknown') {
    warn(`Unknown model family for '${fromModel}' — using defaults for comparison`);
  }
  if (toResolved.family === 'unknown') {
    warn(`Unknown model family for '${toModel}' — using defaults for comparison`);
  }

  // Get project context for token estimates
  let projectTokens = 0;
  try {
    const projectRoot = findProjectRoot();
    const config = loadConfig(projectRoot);
    const analysis = analyzeProject(projectRoot, config.context || {});
    projectTokens = analysis.totalTokens;
  } catch {}

  heading(`Model Switch: ${fromModel} → ${toModel}`);
  console.log();

  const result = compareModels(fromModel, toModel, { projectTokens });

  // Identity
  info('Model Details:');
  table([
    ['From', `${result.from.model} (${result.from.family}, ${result.from.tier || 'default'} tier, v${result.from.version || '?'})`],
    ['To', `${result.to.model} (${result.to.family}, ${result.to.tier || 'default'} tier, v${result.to.version || '?'})`],
  ]);
  console.log();

  // Token impact
  info('Token Impact:');
  table([
    ['Tokens (from)', formatTokens(result.tokenDelta.from)],
    ['Tokens (to)', formatTokens(result.tokenDelta.to)],
    ['Change', result.tokenDelta.change],
  ]);
  console.log();

  // Cost impact
  info('Cost Impact:');
  table([
    ['Cost/1M (from)', `$${result.costDelta.fromPer1M.toFixed(2)}`],
    ['Cost/1M (to)', `$${result.costDelta.toPer1M.toFixed(2)}`],
    ['Per context load (from)', result.costDelta.fromPerLoad < 0.01 ? '< $0.01' : `$${result.costDelta.fromPerLoad.toFixed(4)}`],
    ['Per context load (to)', result.costDelta.toPerLoad < 0.01 ? '< $0.01' : `$${result.costDelta.toPerLoad.toFixed(4)}`],
    ['Change', `${result.costDelta.change} (${result.costDelta.direction.replace('_', ' ')})`],
  ]);
  console.log();

  // Context window
  info('Context Window:');
  table([
    ['From', `${formatTokens(result.contextWindow.from)} tokens`],
    ['To', `${formatTokens(result.contextWindow.to)} tokens`],
    ['Project fits?', result.contextWindow.fits ? '✓ Yes' : '⛔ NO — project too large!'],
    ['Headroom', result.contextWindow.headroom],
  ]);

  if (!result.contextWindow.fits) {
    console.log();
    error(`⚠ Your project (${formatTokens(result.tokenDelta.to)} tokens) exceeds the ${toModel} context window (${formatTokens(result.contextWindow.to)})`);
    dim('  Consider excluding large files in .cortex/config.yaml → context.exclude');
  }
  console.log();

  // Format change
  if (result.formatChange.changed) {
    warn(`Format change: ${result.formatChange.description}`);
    info('Run `cortex compile` to re-optimize instructions for the new model.');
    console.log();
  } else {
    success('No format change needed — same instruction style.');
    console.log();
  }

  // Strengths diff
  if (result.strengthsDelta.gained.length > 0 || result.strengthsDelta.lost.length > 0) {
    info('Capability Changes:');
    if (result.strengthsDelta.gained.length > 0) {
      success(`  Gained: ${result.strengthsDelta.gained.join(', ')}`);
    }
    if (result.strengthsDelta.lost.length > 0) {
      warn(`  Lost:   ${result.strengthsDelta.lost.join(', ')}`);
    }
    console.log();
  }

  // Prompt tips
  if (result.tipsDelta.gained.length > 0 || result.tipsDelta.lost.length > 0) {
    info('Prompting Tips:');
    if (result.tipsDelta.gained.length > 0) {
      for (const tip of result.tipsDelta.gained) {
        dim(`  + ${formatTip(tip)}`);
      }
    }
    if (result.tipsDelta.lost.length > 0) {
      for (const tip of result.tipsDelta.lost) {
        dim(`  - ${formatTip(tip)} (no longer applies)`);
      }
    }
    console.log();
  }

  // Summary
  if (result.recompileNeeded) {
    warn('⚡ Recompile recommended: `cortex compile`');
  }

  if (result.sameFamilySwitch) {
    dim('This is a within-family switch (e.g., version upgrade). Minimal changes expected.');
  }

  console.log();
}

function formatTip(tipKey) {
  const descriptions = {
    prefillResponse: 'Start assistant response to guide output format',
    useExamples: 'Include few-shot examples for better output',
    chainOfThought: 'Ask to think step-by-step for complex tasks',
    avoidAmbiguity: 'Use direct imperatives, avoid hedging',
    leadingWords: 'End prompt with the start of desired output',
    completionBias: 'Use completion-style for formatting control',
    jsonMode: 'Request structured JSON when needed',
    minimalInstructions: 'Less scaffolding — state the problem clearly',
    problemFocused: 'Focus on the problem, let model reason',
    avoidChainOfThought: 'Model does CoT internally — don\'t ask for it',
    contextFirst: 'Put context before questions for long contexts',
    explicitPlanning: 'Ask model to plan before executing',
    selfCritique: 'Ask model to review its own output',
    scopeDefinition: 'Be explicit about what\'s in/out of scope',
    consistentFormatting: 'Pick one tagging style and stick with it',
    shortContext: 'Keep instructions concise — smaller context window',
    explicitConstraints: 'State constraints clearly and explicitly',
    repeatCritical: 'Repeat critical rules at beginning and end',
  };
  return descriptions[tipKey] || tipKey;
}
