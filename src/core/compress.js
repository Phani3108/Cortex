// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rule budget fitting for programmatic users (src/index.js).
 *
 * Deliberately conservative: removes exact duplicates, then keeps the
 * highest-scoring whole rules that fit. It never rewrites or merges rules,
 * and never drops critical ones. The compiler does the same per target via
 * the engine's fitRules().
 */

import { dedupeRules } from '../engine/index.js';
import { scoreRules, optimizeForBudget } from './scoring.js';
import { tokensForModel } from './tokens.js';
import { getHighlight } from './registry.js';

const textOf = rule => String(rule.text ?? rule.content ?? '');

/**
 * @param {Array} rules        - [{ text | content, category?, priority? }]
 * @param {number} tokenBudget - max tokens for the rules' text
 * @param {string} [modelName]
 * @returns {{ compressed: Array, dropped: Array, stats: object }}
 */
export function compressRules(rules, tokenBudget, modelName = getHighlight('anthropic', 'sonnet')) {
  const originalTokens = countTokens(rules, modelName);
  const unique = dedupeRules(rules.map(r => ({ ...r, text: textOf(r) })));
  const scored = scoreRules(unique, modelName);
  const fit = countTokens(unique, modelName) <= tokenBudget
    ? { included: scored, excluded: [] }
    : optimizeForBudget(scored, tokenBudget);

  // Restore source order for the rules that remain.
  const keep = new Set(fit.included.map(r => r.text));
  const compressed = unique.filter(r => keep.has(r.text));
  const compressedTokens = countTokens(compressed, modelName);

  return {
    compressed,
    dropped: fit.excluded,
    stats: {
      originalRules: rules.length,
      originalTokens,
      duplicatesRemoved: rules.length - unique.length,
      compressedRules: compressed.length,
      compressedTokens,
      compressionRatio: originalTokens ? +((1 - compressedTokens / originalTokens) * 100).toFixed(1) : 0,
      fitsInBudget: compressedTokens <= tokenBudget,
    },
  };
}

/** True when the rules' text exceeds the token budget. */
export function needsCompression(rules, tokenBudget, modelName = getHighlight('anthropic', 'sonnet')) {
  return countTokens(rules, modelName) > tokenBudget;
}

function countTokens(rules, modelName) {
  return rules.reduce((sum, r) => sum + tokensForModel(textOf(r), modelName), 0);
}
