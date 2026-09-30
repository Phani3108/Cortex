// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex-aictx — programmatic API.
 *
 *   import { compileProject, compile, TARGETS } from 'cortex-aictx';
 *   import { compile } from 'cortex-aictx/engine';   // pure, browser-safe subset
 */

// Engine (pure): compile, targets, parsing, formatting, budgets, tokens
export * from './engine/index.js';
export { COMMANDS, COMMAND_GROUPS } from './engine/commands.js';

// Project I/O
export { compileProject, loadRuleFiles, loadSkillFiles } from './core/sources.js';
export { planWrites, planRemovals } from './core/outputs.js';
export { loadConfig, saveConfig } from './core/config.js';
export { loadProfile, saveProfile } from './core/profile.js';
export { findProjectRoot, getCortexDir } from './utils/fs.js';
export { saveManifest, loadManifest, detectUserEdits } from './core/manifest.js';
export { getProvider, getAllProviders, getEnabledProviders } from './providers/index.js';

// Models & pricing
export { resolveModel, getFormatFamily, getTokenizerFamily, getCharsPerToken, getModelStrategy, MODEL_FAMILIES } from './core/families.js';
export { loadRegistry, findModel, getModelCost, getModelPricing, getContextWindow, getAllModels, getAllModelCosts, getProviderModels, getModelEntry, getHighlight, getRegistryInfo, isRegistryStale, syncRegistry } from './core/registry.js';
export { buildRegistryFromOpenRouter, diffRegistries } from './core/registry-build.js';
export { analyzeProject, estimateCost } from './core/tokens.js';
export { compareModels, compareProviders } from './core/compare.js';
export { analyzeBudget } from './core/budget.js';

// Analysis
export { getProviderSpec, PROVIDER_SPECS } from './core/specs.js';
export { generateTips, formatTipsForDisplay } from './core/tips.js';
export { assessHealth } from './core/health.js';
export { scoreRules, optimizeForBudget, generateImpactReport } from './core/scoring.js';
export { compressRules, needsCompression } from './core/compress.js';
export { formatForModel, compileForProvider } from './core/compiler.js';

// Learning loop
export { captureSignals } from './core/signals.js';
export { distillSignals, applyAdaptation } from './core/adapt.js';
export { detectModelSwitch } from './core/watch.js';
export { listPacks, getPack, suggestRules, suggestMissingRules, syncCommunityPacks, BUILTIN_PACKS } from './core/community.js';
