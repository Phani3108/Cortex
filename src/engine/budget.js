// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Budget fitting — keep the most valuable whole rules when a target has a
 * hard size limit (Windsurf 12K chars, Antigravity 24 KB, AGENTS.md 32 KiB,
 * ChatGPT 5K chars). Never truncates mid-rule, never drops critical rules
 * silently, and always reports exactly what was left out.
 */

import { measure } from './tokens.js';

const CATEGORY_WEIGHT = [
  [/secur|safety|secret|privacy|auth/, 1.0],
  [/context|project|stack|environment/, 0.95],
  [/architect|design|structure|boundar/, 0.85],
  [/learned|correction/, 0.8],
  [/test|quality|verif/, 0.75],
  [/api|contract|data|database|error/, 0.75],
  [/style|convention|naming|format|lint/, 0.6],
  [/workflow|git|commit|review|process/, 0.55],
  [/doc|comment|readme/, 0.45],
];

/** Heuristic value of a rule (0..~2). Explainable on purpose. */
export function scoreRule(rule) {
  const cat = String(rule.category || '').toLowerCase();
  let score = 0.5;
  for (const [re, w] of CATEGORY_WEIGHT) if (re.test(cat)) { score = w; break; }
  const t = rule.text || '';
  if (rule.priority === 'critical') score += 10;         // effectively pinned
  else if (rule.priority === 'high') score += 0.5;
  if (/\b(never|always|must|do not|don't)\b/i.test(t)) score += 0.2;
  if (/`[^`]+`|\b\d+\b|[\w-]+\/[\w./-]+|\.\w{2,4}\b/.test(t)) score += 0.15; // concrete: code, numbers, paths
  if (typeof rule.confidence === 'number') score += (rule.confidence - 0.5) * 0.4;
  const len = t.length;
  if (len > 400) score -= 0.25;                          // long rules cost more than they return
  return Math.round(score * 1000) / 1000;
}

/**
 * Choose which rules to keep so render(kept) fits the budget.
 *
 * @param {Array} rules
 * @param {object} budget   - { unit: 'chars'|'bytes'|'tokens', limit: number }
 * @param {Function} render - (rules) => full file text (header included)
 * @param {string} tokenizer
 * @returns {{ kept: Array, dropped: Array, size: number, fits: boolean }}
 */
export function fitRules(rules, budget, render, tokenizer = 'default') {
  const size = list => measure(render(list), budget.unit, tokenizer);
  const full = size(rules);
  if (!budget?.limit || full <= budget.limit) return { kept: rules, dropped: [], size: full, fits: true };

  // Rank by score; keep original order when rendering.
  const ranked = rules.map((r, i) => ({ r, i, s: scoreRule(r) })).sort((a, b) => b.s - a.s || a.i - b.i);
  const keep = new Set();
  let current = size([]);
  for (const { r, i } of ranked) {
    keep.add(i);
    const trial = size(rules.filter((_, j) => keep.has(j)));
    if (trial > budget.limit) keep.delete(i);
    else current = trial;
  }
  const kept = rules.filter((_, i) => keep.has(i));
  const dropped = rules.filter((_, i) => !keep.has(i));
  return { kept, dropped, size: current, fits: current <= budget.limit };
}
