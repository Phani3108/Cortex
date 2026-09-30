// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rule scoring — thin, stable API over the engine's scoreRule(), which is
 * the same heuristic the compiler uses to decide what to keep when a target
 * has a hard size limit. Kept for programmatic users (src/index.js).
 */

import { scoreRule } from '../engine/index.js';
import { tokensForModel } from './tokens.js';
import { getHighlight } from './registry.js';

const textOf = rule => String(rule.text ?? rule.content ?? '');

/**
 * Score rules, highest value first.
 * @param {Array} rules - [{ text | content, category?, priority?, confidence? }]
 * @param {string} [modelName] - model whose tokenizer prices each rule
 * @returns {Array} rules with `scores: { impact, tokenCost }`
 */
export function scoreRules(rules, modelName = getHighlight('anthropic', 'sonnet')) {
  return rules
    .map((rule, i) => {
      const text = textOf(rule);
      return { ...rule, text, _i: i, scores: { impact: scoreRule({ ...rule, text }), tokenCost: tokensForModel(text, modelName) } };
    })
    .sort((a, b) => b.scores.impact - a.scores.impact || a._i - b._i)
    .map(({ _i, ...r }) => r);
}

/**
 * Keep the highest-scoring rules that fit `tokenBudget`. Critical rules are
 * always kept (and counted), so the result is never silently empty.
 */
export function optimizeForBudget(scoredRules, tokenBudget) {
  const included = [];
  const excluded = [];
  let totalTokens = 0;
  for (const rule of scoredRules) {
    const cost = rule.scores.tokenCost;
    if (rule.priority === 'critical' || totalTokens + cost <= tokenBudget) {
      included.push(rule);
      totalTokens += cost;
    } else {
      excluded.push(rule);
    }
  }
  return {
    included,
    excluded,
    totalTokens,
    utilization: tokenBudget > 0 ? +((totalTokens / tokenBudget) * 100).toFixed(1) : 0,
    savedTokens: excluded.reduce((sum, r) => sum + r.scores.tokenCost, 0),
  };
}

/** Summary of scored rules: totals plus top and bottom rules. */
export function generateImpactReport(scoredRules) {
  const brief = r => ({
    content: r.text.length > 80 ? `${r.text.slice(0, 80)}…` : r.text,
    impact: r.scores.impact,
    tokens: r.scores.tokenCost,
    source: r.source || 'unknown',
  });
  return {
    totalRules: scoredRules.length,
    totalTokens: scoredRules.reduce((sum, r) => sum + r.scores.tokenCost, 0),
    topRules: scoredRules.slice(0, 10).map(brief),
    bottomRules: scoredRules.length > 10 ? scoredRules.slice(-5).map(brief) : [],
  };
}
