// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Token budget analysis — what a tool loads every session (the compiled
 * always-on instructions), how much project context `context.include`
 * covers, and what that costs on current models.
 *
 * Models, prices and context windows all come from the registry. Models the
 * registry doesn't know are priced from their newest family sibling and are
 * marked `estimated`.
 */

import { TARGETS, CHARS_PER_TOKEN, estimateTokens, tokenizerFor, measure } from '../engine/index.js';
import { resolveModel } from './families.js';
import { findModel, newestSibling, getModelPricing, getModelCost, getContextWindow, getHighlight, getProviderModels } from './registry.js';
import { defaultModelFor } from './specs.js';
import { analyzeProject, includeExists } from './tokens.js';
import { inspectProject, compileTargetAlone } from './health.js';

/** Vendor tiers that make a representative, current comparison set. */
const REPRESENTATIVE = [
  ['anthropic', 'sonnet'], ['anthropic', 'opus'], ['anthropic', 'haiku'],
  ['openai', 'sol'], ['openai', 'luna'],
  ['google', 'flash'], ['google', 'pro'],
  ['x-ai', 'default'],
  ['deepseek', 'flash'],
];

/** Current representative model ids from registry highlights (missing ones skipped). */
export function representativeModels() {
  const ids = REPRESENTATIVE.map(([vendor, tier]) => getHighlight(vendor, tier)).filter(Boolean);
  return [...new Set(ids)];
}

/**
 * Everything the analysis commands need to know about a model name.
 * `estimated` is true when the registry has no exact entry.
 */
export function describeModel(name) {
  const entry = findModel(name);
  const { family, tier } = resolveModel(name);
  const basis = entry ? null : newestSibling(name);
  const pricing = getModelPricing(name);
  return {
    name,
    id: entry?.id || name,
    known: !!entry,
    estimated: !entry,
    basis: basis?.id || null,
    family,
    tier,
    tokenizer: tokenizerFor(family),
    contextWindow: getContextWindow(name),
    input: pricing?.input ?? getModelCost(name),
    output: pricing?.output ?? null,
    cacheRead: pricing?.cacheRead ?? null,
  };
}

/** Tokens a model sees for `chars` characters of text. */
export function tokensFromChars(chars, tokenizer) {
  return Math.ceil(chars / (CHARS_PER_TOKEN[tokenizer] || CHARS_PER_TOKEN.default));
}

/** Dollar amounts from fractions of a cent to thousands, never "< $0.01". */
export function formatUSD(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  if (n >= 100) return `$${Math.round(n).toLocaleString('en-US')}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toPrecision(2)}`;
  return '<$0.0001';
}

/** Per-1M-token prices: always two decimals when ≥ 1¢. */
export function formatPrice(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n >= 0.01 || n === 0 ? `$${n.toFixed(2)}` : `$${Number(n.toPrecision(2))}`;
}

/** Pick the target to analyse: explicit, else one that offers the model, else the first enabled. */
export function pickTarget(inspection, targetId, modelName) {
  if (targetId) return targetId;
  const enabled = Object.keys(inspection.report);
  if (modelName) {
    const id = describeModel(modelName).id;
    const match = enabled.find(t => getProviderModels(t).includes(id));
    if (match) return match;
  }
  return enabled[0] || null;
}

/**
 * Budget report for one model + target.
 *
 * @param {string} projectRoot
 * @param {object} [_config]   - unused (sources are re-read); kept for API compatibility
 * @param {string} [modelName] - defaults to the target's usual model
 * @param {string} [targetId]  - engine target id; defaults to the first enabled
 */
export function analyzeBudget(projectRoot, _config, modelName, targetId, { inspection = inspectProject(projectRoot) } = {}) {
  const config = inspection.config;
  const id = pickTarget(inspection, targetId, modelName);
  const target = id ? TARGETS[id] : null;
  const model = describeModel(modelName || (id && defaultModelFor(id)) || getHighlight('anthropic', 'sonnet'));

  // Always-on + on-demand files for this target
  let outputs = inspection.outputs;
  let entry = id ? inspection.report[id] : null;
  if (id && !entry) {
    const alone = compileTargetAlone(inspection, id);
    outputs = alone.outputs;
    entry = alone.report[id];
  }
  const mine = id ? outputs.filter(o => (o.targets || [o.target]).includes(id)) : [];
  let alwaysOn = mine.filter(o => o.kind === 'instructions');
  if (entry?.viaAgentsMd) alwaysOn = outputs.filter(o => o.path === TARGETS.codex.mainFile);
  const alwaysOnFiles = alwaysOn.map(o => ({ path: o.path, chars: o.content.length, tokens: estimateTokens(o.content, model.tokenizer) }));
  const alwaysOnTokens = alwaysOnFiles.reduce((s, f) => s + f.tokens, 0);
  const onDemand = mine.filter(o => o.kind !== 'instructions');

  // Project context (context.include / exclude; generated outputs and .cortex/ skipped)
  const skip = new Set([...inspection.outputs.map(o => o.path), ...(inspection.manifest?.files || []).map(e => e.file)]);
  const project = analyzeProject(projectRoot, config.context || {}, { skip });
  const projectTokens = tokensFromChars(project.totalSize, model.tokenizer);
  const includeMissing = project.include.length > 0 && !includeExists(projectRoot, project.include);

  const window = model.contextWindow || 0;
  const perSession = (alwaysOnTokens / 1e6) * (model.input || 0);

  return {
    model,
    target: target ? { id, name: target.name, viaAgentsMd: !!entry?.viaAgentsMd, budget: target.budget } : null,
    alwaysOn: { files: alwaysOnFiles, tokens: alwaysOnTokens, percentage: window ? alwaysOnTokens / window * 100 : 0 },
    onDemand: { files: onDemand.length, scoped: onDemand.filter(o => o.kind === 'scoped').length, skills: onDemand.filter(o => o.kind === 'skill').length },
    project: { ...project, modelTokens: projectTokens, includeMissing },
    available: { tokens: Math.max(0, window - alwaysOnTokens), percentage: window ? (window - alwaysOnTokens) / window * 100 : 0 },
    cost: {
      perSession,
      perSessionCached: model.cacheRead !== null ? (alwaysOnTokens / 1e6) * model.cacheRead : null,
      per1kSessions: perSession * 1000,
    },
    optimizations: findOptimizations({ model, alwaysOnTokens, window, project, projectTokens, includeMissing, target, alwaysOn }),
    comparison: compareAcrossModels(alwaysOn.reduce((s, o) => s + o.content.length, 0), project.totalSize, model),
  };
}

function findOptimizations({ model, alwaysOnTokens, window, project, projectTokens, includeMissing, target, alwaysOn }) {
  const opts = [];
  if (window && alwaysOnTokens > window * 0.05) {
    opts.push({ severity: 'high', message: `Always-on instructions take ${(alwaysOnTokens / window * 100).toFixed(1)}% of ${model.id}'s window every session — move task-specific rules into skills.` });
  }
  if (target) {
    const { unit, soft, hard } = target.budget;
    for (const o of alwaysOn) {
      const size = measure(o.content, unit, model.tokenizer);
      if (hard && size > hard * 0.9) opts.push({ severity: 'high', message: `${o.path} is ${size}/${hard} ${unit} — near ${target.name}'s hard limit.` });
      else if (soft && size > soft) opts.push({ severity: 'medium', message: `${o.path} is ${size} ${unit} (guidance ≤ ${soft}).` });
    }
  }
  if (includeMissing) {
    opts.push({ severity: 'medium', message: `None of context.include (${project.include.join(', ')}) exists — set it in .cortex/config.yaml to your source folders.` });
  }
  if (window && projectTokens > window) {
    opts.push({ severity: 'info', message: `Included project files (~${Math.round(projectTokens / 1000)}K tokens) exceed the window; tools will read them selectively.` });
  }
  for (const f of project.largestFiles.slice(0, 3)) {
    if (f.tokens > 20000) opts.push({ severity: 'info', message: `${f.path} is ~${Math.round(f.tokens / 1000)}K tokens — large files are expensive to read in full.` });
  }
  return opts;
}

function compareAcrossModels(alwaysOnChars, projectChars, current) {
  const ids = representativeModels();
  if (!ids.includes(current.id)) ids.unshift(current.name);
  return ids.map(name => {
    const m = name === current.name ? current : describeModel(name);
    const alwaysOnTokens = tokensFromChars(alwaysOnChars, m.tokenizer);
    const tokens = alwaysOnTokens + tokensFromChars(projectChars, m.tokenizer);
    const window = m.contextWindow || 0;
    return {
      model: m.id,
      current: m.id === current.id,
      estimated: m.estimated,
      alwaysOnTokens,
      tokens,
      contextWindow: window,
      costPerSession: (alwaysOnTokens / 1e6) * (m.input || 0),
      input: m.input,
      fits: window > 0 && tokens <= window,
      headroom: window ? (window - tokens) / window * 100 : 0,
    };
  });
}
