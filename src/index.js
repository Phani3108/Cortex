// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex — Universal AI Context Engine
 *
 * Carry your intelligence across every AI coding tool and every project.
 * One config layer that compiles to Claude, Cursor, Copilot, Windsurf,
 * Antigravity, Codex, Gemini, OpenAI, and more.
 */

export { loadConfig, saveConfig } from './core/config.js';
export { loadProfile, saveProfile } from './core/profile.js';
export { analyzeProject, estimateTokens, estimateCost, getTokenFamily, getModelCosts } from './core/tokens.js';
export { getProvider, getAllProviders, getEnabledProviders } from './providers/index.js';
export { findProjectRoot, getCortexDir } from './utils/fs.js';
export { captureSignals } from './core/signals.js';
export { distillSignals, applyAdaptation } from './core/adapt.js';
export { getProviderSpec, getModelFamily, PROVIDER_SPECS, MODEL_STRATEGIES } from './core/specs.js';
export { formatForModel, compileForProvider } from './core/compiler.js';
export { saveManifest, loadManifest, detectUserEdits } from './core/manifest.js';

// Phase 0: Family-based model classification (future-proof)
export { resolveModel, getFormatFamily, getTokenizerFamily, getCharsPerToken, getModelStrategy, estimateTierCost, estimateContextWindow, MODEL_FAMILIES } from './core/families.js';

// Phase 1: Model registry (auto-synced pricing & model data)
export { loadRegistry, getModelCost, getContextWindow, getAllModels, getAllModelCosts, getProviderModels, getModelEntry, isRegistryStale, syncRegistry } from './core/registry.js';

// Phase 1: Comparison engine (model switch + provider migration)
export { compareModels, compareProviders } from './core/compare.js';

// Phase 1: Budget analysis (pre-session token intelligence)
export { analyzeBudget } from './core/budget.js';

// Phase 2: Inline tips engine (model-specific advice after compile)
export { generateTips, formatTipsForDisplay } from './core/tips.js';

// Phase 2: Provider health assessment
export { assessHealth } from './core/health.js';

// Phase 2: Rule impact scoring + budget optimization
export { scoreRules, optimizeForBudget, generateImpactReport } from './core/scoring.js';

// Phase 2: Prompt compression engine
export { compressRules, needsCompression } from './core/compress.js';

// Phase 2: Watch-mode model switch detection
export { detectModelSwitch } from './core/watch.js';

// Phase 3: Community rules + intelligent suggestions
export { listPacks, getPack, suggestRules, suggestMissingRules, syncCommunityPacks, BUILTIN_PACKS } from './core/community.js';
