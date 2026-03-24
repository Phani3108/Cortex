// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Model & Provider Comparison Engine.
 *
 * Powers `cortex switch` (model → model) and `cortex migrate` (provider → provider).
 * Computes structured diffs across tokens, cost, formatting, features, and tips.
 */

import { resolveModel, getFormatFamily, getCharsPerToken, getModelStrategy } from './families.js';
import { getModelCost, getContextWindow, getProviderModels } from './registry.js';
import { PROVIDER_SPECS } from './specs.js';
import { estimateTokens, formatTokens } from './tokens.js';

// ── Model Comparison ────────────────────────────────────────────────────────

/**
 * Compare two models. Returns a structured diff of everything that changes.
 *
 * @param {string} fromModel - Current model name (e.g., 'claude-sonnet-4')
 * @param {string} toModel   - Target model name (e.g., 'gpt-5.1')
 * @param {object} options   - { projectTokens, compiledContent }
 * @returns {object} Structured comparison result
 */
export function compareModels(fromModel, toModel, options = {}) {
  const { projectTokens = 0, compiledContent = '' } = options;

  const fromResolved = resolveModel(fromModel);
  const toResolved = resolveModel(toModel);

  const fromCost = getModelCost(fromModel);
  const toCost = getModelCost(toModel);
  const fromWindow = getContextWindow(fromModel);
  const toWindow = getContextWindow(toModel);

  const fromCpt = getCharsPerToken(fromModel);
  const toCpt = getCharsPerToken(toModel);

  // Recalculate tokens for same content with different tokenizers
  const contentLen = compiledContent.length || projectTokens * fromCpt; // approximate char count
  const fromTokens = projectTokens || Math.ceil(contentLen / fromCpt);
  const toTokens = Math.ceil(contentLen / toCpt);

  const fromFormat = getFormatFamily(fromModel);
  const toFormat = getFormatFamily(toModel);

  const fromStrategy = getModelStrategy(fromModel);
  const toStrategy = getModelStrategy(toModel);

  // Feature diff
  const fromStrengths = new Set(fromStrategy.strengths || []);
  const toStrengths = new Set(toStrategy.strengths || []);
  const gained = [...toStrengths].filter(s => !fromStrengths.has(s));
  const lost = [...fromStrengths].filter(s => !toStrengths.has(s));

  // Prompt tips diff
  const fromTips = Object.keys(fromStrategy.tips || {}).filter(k => fromStrategy.tips[k]);
  const toTips = Object.keys(toStrategy.tips || {}).filter(k => toStrategy.tips[k]);
  const tipsGained = toTips.filter(t => !fromTips.includes(t));
  const tipsLost = fromTips.filter(t => !toTips.includes(t));

  // Cost calculation
  const fromCostPerLoad = (fromTokens / 1_000_000) * fromCost;
  const toCostPerLoad = (toTokens / 1_000_000) * toCost;
  const costChange = fromCostPerLoad > 0 ? ((toCostPerLoad - fromCostPerLoad) / fromCostPerLoad * 100) : 0;

  // Context window check
  const fits = toTokens <= toWindow;
  const headroom = toWindow > 0 ? ((toWindow - toTokens) / toWindow * 100) : 0;

  return {
    from: {
      model: fromModel,
      family: fromResolved.family,
      tier: fromResolved.tier,
      version: fromResolved.version,
    },
    to: {
      model: toModel,
      family: toResolved.family,
      tier: toResolved.tier,
      version: toResolved.version,
    },
    tokenDelta: {
      from: fromTokens,
      to: toTokens,
      change: fromTokens > 0 ? `${toTokens > fromTokens ? '+' : ''}${((toTokens - fromTokens) / fromTokens * 100).toFixed(1)}%` : '0%',
    },
    costDelta: {
      fromPerLoad: fromCostPerLoad,
      toPerLoad: toCostPerLoad,
      fromPer1M: fromCost,
      toPer1M: toCost,
      change: `${costChange > 0 ? '+' : ''}${costChange.toFixed(1)}%`,
      direction: costChange > 0 ? 'more_expensive' : costChange < 0 ? 'cheaper' : 'same',
    },
    contextWindow: {
      from: fromWindow,
      to: toWindow,
      fits,
      headroom: `${headroom.toFixed(1)}%`,
    },
    formatChange: {
      from: fromFormat,
      to: toFormat,
      changed: fromFormat !== toFormat,
      description: fromFormat !== toFormat
        ? `${formatFamilyName(fromFormat)} → ${formatFamilyName(toFormat)}`
        : 'No format change',
    },
    strengthsDelta: { gained, lost },
    tipsDelta: { gained: tipsGained, lost: tipsLost },
    recompileNeeded: fromFormat !== toFormat,
    sameFamilySwitch: fromResolved.family === toResolved.family,
  };
}

// ── Provider Comparison ─────────────────────────────────────────────────────

/**
 * Compare two providers. Returns structured diff of files, features, budgets.
 *
 * @param {string} fromSlug - Current provider (e.g., 'copilot')
 * @param {string} toSlug   - Target provider (e.g., 'cursor')
 * @returns {object} Structured comparison result
 */
export function compareProviders(fromSlug, toSlug) {
  const fromSpec = PROVIDER_SPECS[fromSlug];
  const toSpec = PROVIDER_SPECS[toSlug];

  if (!fromSpec || !toSpec) {
    return { error: `Unknown provider: ${fromSpec ? toSlug : fromSlug}` };
  }

  // File changes
  const fromFiles = (fromSpec.contextFiles || []).map(f => f.path);
  const toFiles = (toSpec.contextFiles || []).map(f => f.path);
  const filesRemoved = fromFiles.filter(f => !toFiles.includes(f));
  const filesAdded = toFiles.filter(f => !fromFiles.includes(f));

  // Feature diff
  const fromFeatures = fromSpec.features || {};
  const toFeatures = toSpec.features || {};
  const allFeatureKeys = new Set([...Object.keys(fromFeatures), ...Object.keys(toFeatures)]);
  const featuresGained = [];
  const featuresLost = [];
  const featuresSame = [];
  for (const key of allFeatureKeys) {
    const had = !!fromFeatures[key];
    const has = !!toFeatures[key];
    if (!had && has) featuresGained.push(key);
    else if (had && !has) featuresLost.push(key);
    else if (had && has) featuresSame.push(key);
  }

  // Token budget
  const fromBudget = fromSpec.tokenLimits?.instructionBudget || null;
  const toBudget = toSpec.tokenLimits?.instructionBudget || null;
  const fromWindow = fromSpec.tokenLimits?.contextWindow || 128000;
  const toWindow = toSpec.tokenLimits?.contextWindow || 128000;

  // Models
  const fromModels = getProviderModels(fromSlug);
  const toModels = getProviderModels(toSlug);
  // Fall back to spec models if registry is empty for this provider
  const effectiveFromModels = fromModels.length > 0 ? fromModels : (fromSpec.models || []);
  const effectiveToModels = toModels.length > 0 ? toModels : (toSpec.models || []);
  const modelsGained = effectiveToModels.filter(m => !effectiveFromModels.includes(m));
  const modelsLost = effectiveFromModels.filter(m => !effectiveToModels.includes(m));

  // Format change
  const fromFormat = fromSpec.adaptationStrategy || 'markdown_sections';
  const toFormat = toSpec.adaptationStrategy || 'markdown_sections';

  // Best practices for the new provider
  const bestPractices = toSpec.bestPractices || {};

  return {
    from: { slug: fromSlug, name: fromSpec.name },
    to: { slug: toSlug, name: toSpec.name },
    files: {
      removed: filesRemoved,
      added: filesAdded,
      description: fileChangeDescription(fromSpec, toSpec),
    },
    features: {
      gained: featuresGained,
      lost: featuresLost,
      same: featuresSame,
    },
    tokenBudget: {
      from: fromBudget,
      to: toBudget,
      fromLabel: fromBudget ? `${fromBudget} tokens` : 'unlimited',
      toLabel: toBudget ? `${toBudget} tokens` : 'unlimited',
      change: budgetChangeDescription(fromBudget, toBudget),
    },
    contextWindow: {
      from: fromWindow,
      to: toWindow,
    },
    models: {
      from: effectiveFromModels,
      to: effectiveToModels,
      gained: modelsGained,
      lost: modelsLost,
    },
    formatChange: {
      from: fromFormat,
      to: toFormat,
      changed: fromFormat !== toFormat,
    },
    bestPractices,
    migrationSteps: generateMigrationSteps(fromSlug, toSlug, toSpec),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFamilyName(family) {
  const names = {
    'claude-family': 'XML tags + direct imperatives',
    'openai-family': 'Markdown headers + numbered lists',
    'reasoning-family': 'Minimal problem statement',
    'gemini-family': 'Context-first XML + markdown',
    'open-source': 'Explicit strict instructions',
  };
  return names[family] || family;
}

function fileChangeDescription(fromSpec, toSpec) {
  const fromPrimary = (fromSpec.contextFiles || []).find(f => f.alwaysLoaded && !f.deprecated);
  const toPrimary = (toSpec.contextFiles || []).find(f => f.alwaysLoaded && !f.deprecated);

  if (fromPrimary && toPrimary) {
    return `Primary: ${fromPrimary.path} → ${toPrimary.path}`;
  }
  return '';
}

function budgetChangeDescription(from, to) {
  if (!from && !to) return 'Both unlimited';
  if (!from && to) return `Unlimited → ${to} tokens (new constraint)`;
  if (from && !to) return `${from} tokens → Unlimited (+∞)`;
  const pct = ((to - from) / from * 100).toFixed(0);
  return `${from} → ${to} tokens (${pct > 0 ? '+' : ''}${pct}%)`;
}

function generateMigrationSteps(fromSlug, toSlug, toSpec) {
  const steps = [];

  steps.push(`Run \`cortex compile --provider ${toSlug}\` to generate ${toSpec.name} config files`);

  if (toSpec.bestPractices?.freshChatThreshold) {
    steps.push(`Note: ${toSpec.name} quality degrades after ~${toSpec.bestPractices.freshChatThreshold} messages — start fresh chats regularly`);
  }

  const hasMDC = toSpec.features?.mdcFormat;
  if (hasMDC) {
    steps.push('Review generated .mdc files — add glob patterns in frontmatter for file-specific rules');
  }

  const hasMCP = toSpec.features?.mcpServers;
  if (hasMCP) {
    steps.push(`Configure MCP servers in ${toSpec.name} settings if needed`);
  }

  steps.push(`Open your project in ${toSpec.name} and verify rules are loaded`);

  return steps;
}
