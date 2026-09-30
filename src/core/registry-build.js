// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Registry builder — turns a live upstream model catalog into the Cortex
 * registry format (registry/latest.json).
 *
 * Source: OpenRouter's public models API (no key required). Its prices for
 * first-party models match the vendors' list prices, and new models appear
 * there within hours of launch — which is what keeps Cortex's data current.
 *
 * Used by:
 *   - scripts/refresh-registry.mjs  (daily GitHub Action → commits latest.json)
 *   - `cortex update --source openrouter` (refresh locally without the repo)
 *
 * Pure function: no fs, no network. Pass the parsed API JSON in.
 */

export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

/** Vendors that matter for AI coding tools, mapped to Cortex family ids. */
export const TRACKED_VENDORS = {
  anthropic:    { family: 'anthropic',  label: 'Anthropic' },
  openai:       { family: 'openai-gpt', label: 'OpenAI' },
  google:       { family: 'gemini',     label: 'Google' },
  'x-ai':       { family: 'xai',        label: 'xAI' },
  deepseek:     { family: 'deepseek',   label: 'DeepSeek' },
  mistralai:    { family: 'mistral',    label: 'Mistral' },
  'meta-llama': { family: 'meta-llama', label: 'Meta' },
  qwen:         { family: 'qwen',       label: 'Alibaba Qwen' },
  moonshotai:   { family: 'moonshot',   label: 'Moonshot' },
  'z-ai':       { family: 'zhipu',      label: 'Z.ai' },
  minimax:      { family: 'minimax',    label: 'MiniMax' },
};

/** Tier words recognised per family (order = most specific first). */
export const TIER_WORDS = {
  anthropic:    ['mythos', 'fable', 'opus', 'sonnet', 'haiku'],
  'openai-gpt': ['astra', 'sol', 'terra', 'luna', 'codex', 'nano', 'mini', 'pro', 'chat', 'oss'],
  'openai-reasoning': ['pro', 'mini'],
  gemini:       ['ultra', 'pro', 'flash-lite', 'flash', 'nano', 'gemma'],
  xai:          ['build', 'mini', 'fast'],
  deepseek:     ['pro', 'flash', 'reasoner', 'coder', 'chat', 'r1'],
  mistral:      ['large', 'medium', 'small', 'devstral', 'codestral', 'ministral'],
  'meta-llama': ['maverick', 'scout'],
  qwen:         ['max', 'plus', 'coder', 'flash', 'turbo'],
  moonshot:     ['code', 'thinking'],
  zhipu:        ['prime', 'flashx', 'flash', 'air', 'turbo'],
  minimax:      [],
};

// Model ids we never want in a coding-context registry.
const EXCLUDE_PATTERNS = [
  /:/,                       // variants: ":batch", ":free", ":thinking", ":extended"
  /image|audio|tts|whisper|transcribe|realtime|embed|moderation|guard|lyria|veo|voxtral|omni|vl-|-vl|vision|search|deep-research|computer-use/i,
  /-exp(\b|-)|experimental/i,
  /customtools/i,
];

/**
 * Build a Cortex registry object from an OpenRouter /models response.
 *
 * @param {object} apiJson  - parsed JSON ({ data: [...] })
 * @param {object} [opts]
 * @param {Date}   [opts.now]
 * @param {object} [opts.overrides] - registry/overrides.json contents
 * @param {object} [opts.previous]  - previous registry, used to keep lastUpdated stable when nothing changed
 * @returns {{ registry: object, changes: Array }}
 */
export function buildRegistryFromOpenRouter(apiJson, opts = {}) {
  const now = opts.now || new Date();
  const overrides = opts.overrides || {};
  const rows = Array.isArray(apiJson?.data) ? apiJson.data : [];
  if (rows.length === 0) throw new Error('Upstream catalog is empty or malformed');

  const models = {};
  for (const row of rows) {
    const entry = toEntry(row, now);
    if (!entry) continue;
    // On collision keep the newer model (e.g. dated snapshots vs aliases)
    const existing = models[entry.id];
    if (!existing || existing.released < entry.released) models[entry.id] = entry;
  }

  // Manual corrections win (e.g. a vendor price OpenRouter hasn't picked up yet)
  for (const [id, patch] of Object.entries(overrides.models || {})) {
    models[id] = models[id] ? { ...models[id], ...patch } : { id, ...patch };
  }

  const sorted = Object.fromEntries(
    Object.entries(models).sort(([a, ma], [b, mb]) =>
      (ma.vendor || '').localeCompare(mb.vendor || '') || (mb.released || '').localeCompare(ma.released || '') || a.localeCompare(b)),
  );

  const registry = {
    $schema: 'https://github.com/Phani3108/Cortex/blob/main/registry/README.md',
    version: now.toISOString().slice(0, 10),
    description: 'Cortex Model Registry — pricing and context windows for models used by AI coding tools. Auto-refreshed daily from OpenRouter by .github/workflows/refresh-registry.yml.',
    source: { name: 'OpenRouter', url: OPENROUTER_MODELS_URL },
    lastUpdated: now.toISOString(),
    modelCount: Object.keys(sorted).length,
    vendors: Object.fromEntries(Object.entries(TRACKED_VENDORS).map(([k, v]) => [k, v.label])),
    highlights: buildHighlights(sorted),
    models: sorted,
    providerModels: buildProviderModels(sorted, overrides.providerModels),
    subscriptionProviders: overrides.subscriptionProviders || {},
  };

  const changes = diffRegistries(opts.previous, registry);
  // Keep the timestamp stable when the data itself did not change, so the
  // daily job only commits when something real moved.
  if (opts.previous && changes.length === 0 && opts.previous.lastUpdated) {
    registry.lastUpdated = opts.previous.lastUpdated;
    registry.version = opts.previous.version || registry.version;
  }
  return { registry, changes };
}

function toEntry(row, now) {
  if (!row?.id || typeof row.id !== 'string') return null;
  const [vendor, ...rest] = row.id.split('/');
  const meta = TRACKED_VENDORS[vendor];
  if (!meta || rest.length === 0) return null;
  const slug = rest.join('/');
  if (EXCLUDE_PATTERNS.some(p => p.test(slug))) return null;

  const outputs = row.architecture?.output_modalities;
  if (Array.isArray(outputs) && !outputs.includes('text')) return null;

  const input = perMillion(row.pricing?.prompt);
  const output = perMillion(row.pricing?.completion);
  if (input === null || output === null) return null;
  if (input === 0 && output === 0) return null; // free/preview endpoints distort comparisons

  const family = /^o\d/.test(slug) && vendor === 'openai' ? 'openai-reasoning' : meta.family;
  const { tier, version } = classify(slug, family);

  const expires = row.expiration_date ? String(row.expiration_date).slice(0, 10) : null;
  let status = 'active';
  if (/preview/i.test(slug)) status = 'preview';
  if (expires) status = expires <= now.toISOString().slice(0, 10) ? 'retired' : 'deprecated';
  if (status === 'retired') return null;

  const entry = {
    id: slug,
    name: cleanName(row.name, meta.label),
    vendor,
    family,
    tier,
    version,
    costPer1M: { input, output },
    contextWindow: row.context_length || row.top_provider?.context_length || null,
    maxOutput: row.top_provider?.max_completion_tokens || null,
    released: row.created ? new Date(row.created * 1000).toISOString().slice(0, 10) : null,
    status,
  };
  const cacheRead = perMillion(row.pricing?.input_cache_read);
  if (cacheRead !== null && cacheRead > 0) entry.costPer1M.cacheRead = cacheRead;
  if (expires) entry.expires = expires;
  if (row.knowledge_cutoff) entry.knowledgeCutoff = String(row.knowledge_cutoff).slice(0, 10);
  if (vendor === 'anthropic') entry.apiId = slug.replace(/\./g, '-'); // official ids use hyphens
  return entry;
}

function perMillion(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1e6 * 10000) / 10000;
}

function cleanName(name, vendorLabel) {
  if (!name) return null;
  return String(name).replace(/^[^:]+:\s*/, '').trim() || vendorLabel;
}

/** Extract tier + version from a model slug using the family's tier words. */
export function classify(slug, family) {
  const lower = slug.toLowerCase();
  let tier = '';
  for (const word of TIER_WORDS[family] || []) {
    const re = new RegExp(`(^|[-_.])${word.replace(/-/g, '[-_]')}($|[-_.\\d])`);
    if (re.test(lower)) { tier = word; break; }
  }
  const versionMatch = lower.match(/(?:^|[-_a-z])v?(\d+(?:\.\d+)*)/);
  return { tier, version: versionMatch ? versionMatch[1] : null };
}

/**
 * Pick the newest active model per (vendor, tier) — drives UI "latest" cards,
 * cost estimates for unknown future models, and Stack Lab recommendations.
 */
function buildHighlights(models) {
  const byVendor = {};
  const rank = m => (m.status === 'active' ? 1 : 0);
  for (const m of Object.values(models)) {
    // Previews only count when a tier has no generally-available model yet
    if (!['active', 'preview'].includes(m.status) || !m.vendor) continue;
    const v = (byVendor[m.vendor] ||= {});
    const key = m.tier || 'default';
    const cur = v[key];
    if (!cur || rank(m) > cur.rank || (rank(m) === cur.rank && cur.released < m.released)) {
      v[key] = { id: m.id, released: m.released, rank: rank(m) };
    }
  }
  const out = {};
  for (const [vendor, tiers] of Object.entries(byVendor)) {
    out[vendor] = Object.fromEntries(Object.entries(tiers).map(([t, v]) => [t, v.id]));
  }
  return out;
}

/**
 * Which models each coding tool can run. Derived: tools locked to a vendor get
 * that vendor's active lineup; multi-model IDEs get the newest flagship tiers
 * of the big three. Overrides can pin exact lists.
 */
const PROVIDER_VENDORS = {
  claude:      { vendors: ['anthropic'] },
  codex:       { vendors: ['openai'] },
  gemini:      { vendors: ['google'] },
  cursor:      { vendors: ['anthropic', 'openai', 'google', 'x-ai'], multi: true },
  copilot:     { vendors: ['anthropic', 'openai', 'google'], multi: true },
  windsurf:    { vendors: ['anthropic', 'openai', 'google'], multi: true },
  antigravity: { vendors: ['google', 'anthropic', 'openai'], multi: true },
  kiro:        { vendors: ['anthropic'] },
  openai:      { vendors: ['openai'] },
};

function buildProviderModels(models, pinned = {}) {
  const active = Object.values(models).filter(m => m.status === 'active');
  const out = {};
  for (const [provider, cfg] of Object.entries(PROVIDER_VENDORS)) {
    if (pinned[provider]) { out[provider] = pinned[provider]; continue; }
    const list = [];
    for (const vendor of cfg.vendors) {
      const vendorModels = active
        .filter(m => m.vendor === vendor)
        .sort((a, b) => (b.released || '').localeCompare(a.released || ''));
      if (cfg.multi) {
        // newest model of each tier, max 3 per vendor
        const seen = new Set();
        for (const m of vendorModels) {
          const t = m.tier || m.id;
          if (seen.has(t)) continue;
          seen.add(t);
          list.push(m.id);
          if (seen.size >= 3) break;
        }
      } else {
        list.push(...vendorModels.slice(0, 8).map(m => m.id));
      }
    }
    out[provider] = list;
  }
  return out;
}

/** Human-meaningful diff between two registries (added / removed / repriced). */
export function diffRegistries(prev, next) {
  if (!prev?.models) return next?.models ? [{ type: 'initial', count: Object.keys(next.models).length }] : [];
  const changes = [];
  for (const [id, m] of Object.entries(next.models)) {
    const old = prev.models[id];
    if (!old) { changes.push({ type: 'added', model: id, input: m.costPer1M?.input, output: m.costPer1M?.output }); continue; }
    const oi = typeof old.costPer1M === 'object' ? old.costPer1M.input : old.costPer1M;
    const oo = typeof old.costPer1M === 'object' ? old.costPer1M.output : null;
    if (oi !== m.costPer1M.input || (oo !== null && oo !== m.costPer1M.output)) {
      changes.push({ type: 'price_change', model: id, from: { input: oi, output: oo }, to: { input: m.costPer1M.input, output: m.costPer1M.output } });
    }
    if (old.contextWindow && m.contextWindow && old.contextWindow !== m.contextWindow) {
      changes.push({ type: 'context_change', model: id, from: old.contextWindow, to: m.contextWindow });
    }
    if (old.status && old.status !== m.status) changes.push({ type: 'status_change', model: id, from: old.status, to: m.status });
  }
  for (const id of Object.keys(prev.models)) {
    if (!next.models[id]) changes.push({ type: 'removed', model: id });
  }
  return changes;
}
