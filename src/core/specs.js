// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Provider specs — a read-only view over the engine's TARGETS table
 * (src/engine/targets.js) plus live model data from the registry.
 *
 * Nothing here is hand-maintained: file paths and budgets come from TARGETS,
 * model lists and context windows from the registry. Kept for the analysis
 * commands and programmatic users of `PROVIDER_SPECS`.
 */

import { TARGETS, VERIFIED_ON } from '../engine/targets.js';
import { getFormatFamily, getModelStrategy, MODEL_FAMILIES } from './families.js';
import { getProviderModels, getHighlight, getContextWindow } from './registry.js';

/** modelHint in TARGETS → registry highlight (vendor, tier). */
const HINT_HIGHLIGHTS = {
  'claude-sonnet': ['anthropic', 'sonnet'],
  'gemini-pro': ['google', 'pro'],
  gpt: ['openai', 'sol'],
};

/** Targets whose tool can load MCP servers (ChatGPT export and the PR reviewer cannot). */
const NO_MCP = new Set(['gemini-review', 'openai']);

/**
 * Model a target most likely runs: its modelHint's newest registry model,
 * else the first model the registry lists for that tool. May be null.
 */
export function defaultModelFor(targetId) {
  const target = TARGETS[targetId];
  if (!target) return null;
  const hint = HINT_HIGHLIGHTS[target.modelHint];
  const fromHint = hint ? getHighlight(...hint) : null;
  return fromHint || getProviderModels(targetId)[0] || null;
}

/** Hard budget expressed in (approximate) tokens, for legacy consumers. */
function hardBudgetTokens(budget) {
  if (!budget?.hard) return null;
  if (budget.unit === 'tokens') return budget.hard;
  if (budget.unit === 'chars' || budget.unit === 'bytes') return Math.floor(budget.hard / 4);
  return null; // line budgets have no token equivalent
}

function buildSpec(target) {
  const contextFiles = [
    { path: target.mainFile, kind: 'instructions', location: 'project_root', alwaysLoaded: true },
  ];
  if (target.scopedPattern) {
    contextFiles.push({ path: target.scopedPattern.replace('{slug}', '{name}'), kind: 'scoped', location: 'project_root', alwaysLoaded: false });
  }
  if (target.skillsDir) {
    contextFiles.push({ path: `${target.skillsDir}/{name}/SKILL.md`, kind: 'skill', location: 'project_root', alwaysLoaded: false });
  }

  return {
    name: target.name,
    slug: target.id,
    vendor: target.vendor,
    verified: VERIFIED_ON,
    style: target.style,
    mainFile: target.mainFile,
    contextFiles,
    budget: target.budget,
    features: {
      skills: !!target.skillsDir,
      scopedRules: !!target.scopedPattern,
      agentsMd: target.id === 'codex' || target.readsAgentsMd,
      mcp: !NO_MCP.has(target.id),
    },
    docs: target.docs,
    notes: target.notes,
    tokenLimits: {
      instructionBudget: hardBudgetTokens(target.budget),
      get contextWindow() {
        const model = defaultModelFor(target.id);
        return model ? getContextWindow(model) : null;
      },
    },
    get defaultModel() { return defaultModelFor(target.id); },
    get models() { return getProviderModels(target.id); },
  };
}

export const PROVIDER_SPECS = Object.fromEntries(Object.values(TARGETS).map(t => [t.id, buildSpec(t)]));

const FORMAT_FAMILY = {
  anthropic: 'claude-family',
  'openai-gpt': 'openai-family',
  'openai-reasoning': 'reasoning-family',
  gemini: 'gemini-family',
  deepseek: 'open-source',
};

/**
 * Prompting strategies per format family, derived from families.js.
 * Kept for backward compatibility; new code should use families.js directly.
 */
export const MODEL_STRATEGIES = buildStrategies();

function buildStrategies() {
  const strategies = {};
  for (const [id, fam] of Object.entries(MODEL_FAMILIES)) {
    const key = FORMAT_FAMILY[id];
    if (!key || strategies[key]) continue;
    strategies[key] = {
      formatting: fam.formatting,
      strengths: fam.strengths,
      promptPattern: fam.promptPattern,
      tips: fam.tips,
    };
  }
  return strategies;
}

/** Prompting strategy for a model; `family` is the format family (e.g. 'claude-family'). */
export function getModelFamily(modelName) {
  const strategy = getModelStrategy(modelName);
  return { ...strategy, modelFamily: strategy.family, family: getFormatFamily(modelName) };
}

export function getProviderSpec(name) {
  return PROVIDER_SPECS[name] || null;
}

export function listProviderSpecs() {
  return Object.entries(PROVIDER_SPECS).map(([key, spec]) => ({
    key,
    name: spec.name,
    verified: spec.verified,
    models: spec.models,
  }));
}
