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
