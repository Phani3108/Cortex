// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Model Registry — pricing + context windows, kept current automatically.
 *
 * Resolution (highest priority first):
 *   1. User overrides passed by the caller (profile.yaml `models:`)
 *   2. Local cache  ~/.cortex/registry.json   (written by `cortex update`)
 *   3. Bundled      registry/latest.json      (refreshed daily in the repo)
 *   4. Estimates    newest registry model of the same family + tier,
 *                   then family defaults — so `claude-sonnet-6` works on day 0.
 *
 * Remote sync pulls the repo's latest.json (refreshed daily by GitHub Actions);
 * if that fails it can rebuild directly from the OpenRouter catalog.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { resolveModel, estimateTierCost, estimateContextWindow, SUBSCRIPTION_PROVIDERS } from './families.js';
import { buildRegistryFromOpenRouter, diffRegistries, OPENROUTER_MODELS_URL } from './registry-build.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REGISTRY_URL = 'https://raw.githubusercontent.com/Phani3108/Cortex/main/registry/latest.json';
const BUNDLED_PATH = join(__dirname, '..', '..', 'registry', 'latest.json');
const STALENESS_DAYS = 7;

function cachePath() {
  return join(process.env.CORTEX_HOME || join(homedir(), '.cortex'), 'registry.json');
}

let _cache = null;
let _aliases = null;

// ── Loading ─────────────────────────────────────────────────────────────────

/** Load the merged registry: bundled data overlaid by a newer local cache. */
export function loadRegistry() {
  if (_cache) return _cache;

  const bundled = readJson(BUNDLED_PATH);
  const cached = readJson(cachePath());

  // A cache only wins if it is newer than what shipped with this install.
  let data = bundled || emptyRegistry();
  if (cached?.models && (!bundled || (cached.lastUpdated || '') >= (bundled.lastUpdated || ''))) {
    data = { ...data, ...cached, models: { ...(bundled?.models || {}), ...cached.models } };
  }
  data.models ||= {};
  data.providerModels ||= {};
  data.subscriptionProviders ||= {};
  data.highlights ||= {};

  _cache = data;
  _aliases = null;
  return data;
}

/** Clear the in-memory cache (tests, or after a sync). */
export function clearRegistryCache() {
  _cache = null;
  _aliases = null;
}

function emptyRegistry() {
  return { models: {}, providerModels: {}, subscriptionProviders: {}, highlights: {}, version: null, lastUpdated: null };
}

function readJson(path) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null;
  } catch {
    return null;
  }
}

// ── Name normalisation ──────────────────────────────────────────────────────

/** "anthropic/claude-sonnet-5-5" → "claude-sonnet-5.5" style lookup key. */
export function normalizeModelName(name) {
  if (!name) return '';
  let n = String(name).trim().toLowerCase();
  n = n.replace(/^[a-z0-9-]+\//, '');            // vendor prefix
  n = n.replace(/@.*$/, '');                     // vertex "@date" suffix
  n = n.replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, ''); // dated snapshots
  return n;
}

function aliasIndex(registry) {
  if (_aliases) return _aliases;
  const idx = new Map();
  for (const [key, entry] of Object.entries(registry.models)) {
    const k = key.toLowerCase();
    idx.set(k, key);
    idx.set(k.replace(/\./g, '-'), key);          // claude-sonnet-5-5
    if (entry.apiId) idx.set(entry.apiId.toLowerCase(), key);
  }
  _aliases = idx;
  return idx;
}

/** Find a registry entry by any common spelling of a model id. */
export function findModel(modelName) {
  const registry = loadRegistry();
  if (!modelName) return null;
  if (registry.models[modelName]) return registry.models[modelName];
  const idx = aliasIndex(registry);
  const norm = normalizeModelName(modelName);
  const key = idx.get(norm) || idx.get(norm.replace(/-(\d+)-(\d+)(?=$|-)/, '-$1.$2'));
  return key ? registry.models[key] : null;
}

// ── Querying ────────────────────────────────────────────────────────────────

function inputCost(entry) {
  if (!entry?.costPer1M && entry?.costPer1M !== 0) return null;
  return typeof entry.costPer1M === 'object' ? entry.costPer1M.input : entry.costPer1M;
}

/** Cost per 1M input tokens. Exact match → same family+tier → family default. */
export function getModelCost(modelName, userOverrides = {}) {
  const override = userOverrides[modelName]?.costPer1M;
  if (override !== undefined) return typeof override === 'object' ? override.input : override;
  if (SUBSCRIPTION_PROVIDERS.has(modelName)) return 0;

  const exact = inputCost(findModel(modelName));
  if (exact !== null) return exact;

  const sibling = newestSibling(modelName);
  if (sibling) return inputCost(sibling);
  return estimateTierCost(modelName);
}

/** Full pricing object { input, output, cacheRead? } or null when unknown. */
export function getModelPricing(modelName) {
  const entry = findModel(modelName) || newestSibling(modelName);
  if (!entry?.costPer1M) return null;
  return typeof entry.costPer1M === 'object' ? entry.costPer1M : { input: entry.costPer1M, output: null };
}

/** Context window in tokens. */
export function getContextWindow(modelName, userOverrides = {}) {
  if (userOverrides[modelName]?.contextWindow) return userOverrides[modelName].contextWindow;
  const entry = findModel(modelName);
  if (entry?.contextWindow) return entry.contextWindow;
  const sibling = newestSibling(modelName);
  if (sibling?.contextWindow) return sibling.contextWindow;
  return estimateContextWindow(modelName);
}

/**
 * Newest registry model with the same family + tier. This is how Cortex
 * prices a model that was announced after the last registry refresh.
 */
export function newestSibling(modelName) {
  const { family, tier } = resolveModel(normalizeModelName(modelName));
  if (family === 'unknown') return null;
  const registry = loadRegistry();
  let best = null;
  for (const entry of Object.values(registry.models)) {
    if (entry.family !== family || (entry.tier || '') !== (tier || '')) continue;
    if (entry.status && !['active', 'preview'].includes(entry.status)) continue;
    if (!best || (entry.released || '') > (best.released || '')) best = entry;
  }
  return best;
}

export function getAllModels() {
  return Object.keys(loadRegistry().models);
}

/** modelName → input cost per 1M (active models only). */
export function getAllModelCosts() {
  const costs = {};
  for (const [name, entry] of Object.entries(loadRegistry().models)) {
    if (entry.status && entry.status !== 'active') continue;
    costs[name] = inputCost(entry);
  }
  return costs;
}

export function getProviderModels(providerSlug) {
  return loadRegistry().providerModels?.[providerSlug] || [];
}

export function getModelEntry(modelName) {
  return findModel(modelName);
}

/** Newest active model id for a vendor tier, e.g. ('anthropic','sonnet'). */
export function getHighlight(vendor, tier) {
  return loadRegistry().highlights?.[vendor]?.[tier] || null;
}

// ── Staleness ───────────────────────────────────────────────────────────────

export function getRegistryStaleness() {
  const { lastUpdated } = loadRegistry();
  if (!lastUpdated) return Infinity;
  return Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86_400_000);
}

export function isRegistryStale() {
  return getRegistryStaleness() > STALENESS_DAYS;
}

export function getRegistryInfo() {
  const r = loadRegistry();
  return {
    version: r.version || null,
    lastUpdated: r.lastUpdated || null,
    modelCount: Object.keys(r.models).length,
    source: r.source?.name || 'bundled',
    ageDays: getRegistryStaleness(),
  };
}

// ── Remote Sync ─────────────────────────────────────────────────────────────

/**
 * Refresh the local cache. Tries the repo's daily-refreshed latest.json, then
 * falls back to building from the OpenRouter catalog directly.
 *
 * @param {object} [opts]
 * @param {'auto'|'github'|'openrouter'} [opts.source='auto']
 * @param {string} [opts.url] - custom registry URL (self-hosted mirrors)
 */
export async function syncRegistry(opts = {}) {
  const source = typeof opts === 'string' ? 'github' : (opts.source || 'auto');
  const url = typeof opts === 'string' ? opts : (opts.url || REGISTRY_URL);
  const before = loadRegistry();
  const errors = [];

  let next = null;
  let from = null;
  if (source === 'auto' || source === 'github') {
    try {
      const data = await fetchJson(url);
      if (!data?.models || typeof data.models !== 'object') throw new Error('invalid registry format');
      next = data;
      from = url;
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  if (!next && (source === 'auto' || source === 'openrouter')) {
    try {
      const catalog = await fetchJson(OPENROUTER_MODELS_URL);
      next = buildRegistryFromOpenRouter(catalog, { previous: before }).registry;
      from = OPENROUTER_MODELS_URL;
    } catch (err) {
      errors.push(`${OPENROUTER_MODELS_URL}: ${err.message}`);
    }
  }
  if (!next) return { success: false, error: errors.join('; '), changes: [] };

  const changes = diffRegistries(before, next);
  try {
    const path = cachePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  } catch (err) {
    return { success: false, error: `Cache write failed: ${err.message}`, changes };
  }

  clearRegistryCache();
  return {
    success: true,
    source: from,
    changes,
    modelCount: { before: Object.keys(before.models).length, after: Object.keys(loadRegistry().models).length },
    version: next.version,
    lastUpdated: next.lastUpdated,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'cortex-cli (+https://github.com/Phani3108/Cortex)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
