// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Model Registry — versioned model data with remote sync + local cache.
 *
 * Three-layer resolution:
 * 1. Local cache (~/.cortex/registry.json) — fast, offline-capable
 * 2. Bundled registry (registry/latest.json) — ships with the package
 * 3. Family tier defaults (families.js) — always works for unknown models
 *
 * Remote sync updates the local cache from a published registry URL.
 * User overrides in ~/.cortex/profile.yaml take highest priority.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { resolveModel, estimateTierCost, estimateContextWindow, SUBSCRIPTION_PROVIDERS } from './families.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REGISTRY_URL = 'https://raw.githubusercontent.com/nicobailon/cortex/main/registry/latest.json';
const CACHE_PATH = join(homedir(), '.cortex', 'registry.json');
const BUNDLED_PATH = join(__dirname, '..', '..', 'registry', 'latest.json');
const STALENESS_DAYS = 7;

let _cache = null;

// ── Loading ─────────────────────────────────────────────────────────────────

/**
 * Load the merged registry. Priority: local cache > bundled > empty.
 * User overrides from profile are merged at query time.
 */
export function loadRegistry() {
  if (_cache) return _cache;

  let data = { models: {}, providerModels: {}, subscriptionProviders: {}, version: null, lastUpdated: null };

  // Layer 1: Bundled registry (ships with package)
  try {
    if (existsSync(BUNDLED_PATH)) {
      const bundled = JSON.parse(readFileSync(BUNDLED_PATH, 'utf-8'));
      data = mergeRegistries(data, bundled);
    }
  } catch {}

  // Layer 2: Local cache (may be newer from remote sync)
  try {
    if (existsSync(CACHE_PATH)) {
      const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
      data = mergeRegistries(data, cached);
    }
  } catch {}

  _cache = data;
  return data;
}

/**
 * Clear the in-memory cache (for testing or after sync).
 */
export function clearRegistryCache() {
  _cache = null;
}

// ── Querying ────────────────────────────────────────────────────────────────

/**
 * Get the cost per 1M input tokens for a model.
 * Resolution: exact registry match → family+tier estimation.
 */
export function getModelCost(modelName, userOverrides = {}) {
  // Check user overrides first
  if (userOverrides[modelName]?.costPer1M) {
    return userOverrides[modelName].costPer1M;
  }

  // Check subscription providers
  if (SUBSCRIPTION_PROVIDERS.has(modelName)) return 0;

  // Check registry for exact match
  const registry = loadRegistry();
  const entry = registry.models[modelName];
  if (entry?.costPer1M) {
    return typeof entry.costPer1M === 'object' ? entry.costPer1M.input : entry.costPer1M;
  }

  // Fallback: estimate from family + tier
  return estimateTierCost(modelName);
}

/**
 * Get the context window for a model.
 */
export function getContextWindow(modelName, userOverrides = {}) {
  if (userOverrides[modelName]?.contextWindow) {
    return userOverrides[modelName].contextWindow;
  }

  const registry = loadRegistry();
  const entry = registry.models[modelName];
  if (entry?.contextWindow) return entry.contextWindow;

  return estimateContextWindow(modelName);
}

/**
 * Get all known models from the registry.
 */
export function getAllModels() {
  const registry = loadRegistry();
  return Object.keys(registry.models);
}

/**
 * Get all model costs (for the cost command and budget comparisons).
 * Returns a map of modelName → costPer1M (input).
 */
export function getAllModelCosts() {
  const registry = loadRegistry();
  const costs = {};

  for (const [name, entry] of Object.entries(registry.models)) {
    costs[name] = typeof entry.costPer1M === 'object' ? entry.costPer1M.input : entry.costPer1M;
  }

  // Add subscription providers
  for (const name of SUBSCRIPTION_PROVIDERS) {
    costs[name] = 0;
  }

  return costs;
}

/**
 * Get models available for a specific provider.
 */
export function getProviderModels(providerSlug) {
  const registry = loadRegistry();
  return registry.providerModels?.[providerSlug] || [];
}

/**
 * Get full model entry from registry.
 */
export function getModelEntry(modelName) {
  const registry = loadRegistry();
  return registry.models[modelName] || null;
}

// ── Staleness ───────────────────────────────────────────────────────────────

/**
 * Check how many days since the registry was last updated.
 */
export function getRegistryStaleness() {
  const registry = loadRegistry();
  if (!registry.lastUpdated) return Infinity;

  const lastUpdate = new Date(registry.lastUpdated);
  const now = new Date();
  return Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
}

/**
 * Check if the registry is stale (> STALENESS_DAYS old).
 */
export function isRegistryStale() {
  return getRegistryStaleness() > STALENESS_DAYS;
}

// ── Remote Sync ─────────────────────────────────────────────────────────────

/**
 * Sync registry from remote URL. Returns a diff of what changed.
 */
export async function syncRegistry(url = REGISTRY_URL) {
  const oldRegistry = loadRegistry();
  const oldModelCount = Object.keys(oldRegistry.models).length;

  let remoteData;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'cortex-cli' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    remoteData = await response.json();
  } catch (err) {
    return { success: false, error: err.message, changes: [] };
  }

  // Validate structure
  if (!remoteData.models || typeof remoteData.models !== 'object') {
    return { success: false, error: 'Invalid registry format', changes: [] };
  }

  // Calculate diff
  const changes = [];
  for (const [name, entry] of Object.entries(remoteData.models)) {
    const old = oldRegistry.models[name];
    if (!old) {
      const cost = typeof entry.costPer1M === 'object' ? entry.costPer1M.input : entry.costPer1M;
      changes.push({ type: 'added', model: name, cost, contextWindow: entry.contextWindow });
    } else {
      const oldCost = typeof old.costPer1M === 'object' ? old.costPer1M.input : old.costPer1M;
      const newCost = typeof entry.costPer1M === 'object' ? entry.costPer1M.input : entry.costPer1M;
      if (oldCost !== newCost) {
        changes.push({ type: 'price_change', model: name, from: oldCost, to: newCost });
      }
    }
  }

  // Provider model updates
  if (remoteData.providerModels) {
    for (const [provider, models] of Object.entries(remoteData.providerModels)) {
      const oldModels = oldRegistry.providerModels?.[provider] || [];
      const added = models.filter(m => !oldModels.includes(m));
      for (const m of added) {
        changes.push({ type: 'provider_model', provider, model: m });
      }
    }
  }

  // Save to cache
  try {
    const cacheDir = dirname(CACHE_PATH);
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

    remoteData.lastUpdated = new Date().toISOString();
    writeFileSync(CACHE_PATH, JSON.stringify(remoteData, null, 2));
  } catch (err) {
    return { success: false, error: `Cache write failed: ${err.message}`, changes };
  }

  // Clear in-memory cache so next load picks up new data
  clearRegistryCache();

  const newRegistry = loadRegistry();
  const newModelCount = Object.keys(newRegistry.models).length;

  return {
    success: true,
    changes,
    modelCount: { before: oldModelCount, after: newModelCount },
    version: remoteData.version,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mergeRegistries(base, overlay) {
  return {
    version: overlay.version || base.version,
    lastUpdated: overlay.lastUpdated || base.lastUpdated,
    models: { ...base.models, ...overlay.models },
    providerModels: { ...base.providerModels, ...overlay.providerModels },
    subscriptionProviders: { ...base.subscriptionProviders, ...overlay.subscriptionProviders },
  };
}
