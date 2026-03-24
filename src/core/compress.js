// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt Compression Engine — fit more intelligence into fewer tokens.
 *
 * When token budgets are tight (Copilot: 2K, Cursor: 8K), every token
 * counts. This module compresses rules without losing meaning:
 *
 * 1. Deduplication — remove semantically similar rules
 * 2. Abbreviation — shorten common phrases
 * 3. Merging — combine related rules into compact lists
 * 4. Pruning — remove low-impact rules based on scoring
 * 5. Summarization — condense verbose rules to essentials
 *
 * Compression is lossy but impact-aware: high-value rules are preserved.
 */

import { getCharsPerToken } from './families.js';
import { scoreRules, optimizeForBudget } from './scoring.js';

/**
 * Compress rules to fit within a token budget.
 *
 * @param {Array}  rules       - Array of { content, source, category }
 * @param {number} tokenBudget - Max tokens for output
 * @param {string} modelName   - Target model for tokenizer
 * @param {object} options     - { aggressive, preserveCategories }
 * @returns {object} { compressed, stats }
 */
export function compressRules(rules, tokenBudget, modelName = 'claude-sonnet-4', options = {}) {
  const { aggressive = false, preserveCategories = [] } = options;
  const cpt = getCharsPerToken(modelName);

  let working = rules.map(r => ({ ...r }));
  const stats = {
    originalRules: rules.length,
    originalTokens: estimateTokensForRules(rules, cpt),
    steps: [],
  };

  // Step 1: Deduplicate
  const beforeDedup = working.length;
  working = deduplicateRules(working);
  if (working.length < beforeDedup) {
    stats.steps.push({ step: 'deduplicate', removed: beforeDedup - working.length });
  }

  // Step 2: Abbreviate common phrases
  working = working.map(r => ({ ...r, content: abbreviateContent(r.content) }));
  const afterAbbrev = estimateTokensForRules(working, cpt);
  if (afterAbbrev < stats.originalTokens) {
    stats.steps.push({ step: 'abbreviate', tokensSaved: stats.originalTokens - afterAbbrev });
  }

  // Step 3: Merge related rules by category
  const beforeMerge = working.length;
  working = mergeRelatedRules(working);
  if (working.length < beforeMerge) {
    stats.steps.push({ step: 'merge', merged: beforeMerge - working.length });
  }

  // Step 4: Score and prune by impact
  const currentTokens = estimateTokensForRules(working, cpt);
  if (currentTokens > tokenBudget) {
    const scored = scoreRules(working, modelName);

    // Protect preserved categories
    const protected_ = [];
    const prunable = [];
    for (const r of scored) {
      if (preserveCategories.includes(r.category)) {
        protected_.push(r);
      } else {
        prunable.push(r);
      }
    }

    const protectedTokens = estimateTokensForRules(protected_, cpt);
    const remainingBudget = tokenBudget - protectedTokens;

    if (remainingBudget > 0) {
      const optimized = optimizeForBudget(prunable, remainingBudget);
      working = [...protected_, ...optimized.included];
      if (optimized.excluded.length > 0) {
        stats.steps.push({
          step: 'prune',
          removed: optimized.excluded.length,
          tokensSaved: optimized.savedTokens,
        });
      }
    } else {
      working = protected_;
    }
  }

  // Step 5: If still over budget and aggressive mode, condense long rules
  if (aggressive) {
    const tokensNow = estimateTokensForRules(working, cpt);
    if (tokensNow > tokenBudget) {
      working = condenseLongRules(working, tokenBudget, cpt);
      stats.steps.push({ step: 'condense', note: 'Shortened verbose rules' });
    }
  }

  stats.compressedRules = working.length;
  stats.compressedTokens = estimateTokensForRules(working, cpt);
  stats.compressionRatio = stats.originalTokens > 0
    ? +((1 - stats.compressedTokens / stats.originalTokens) * 100).toFixed(1)
    : 0;
  stats.fitsInBudget = stats.compressedTokens <= tokenBudget;

  return { compressed: working, stats };
}

/**
 * Quick estimate: can these rules fit in the budget without compression?
 */
export function needsCompression(rules, tokenBudget, modelName = 'claude-sonnet-4') {
  const cpt = getCharsPerToken(modelName);
  const tokens = estimateTokensForRules(rules, cpt);
  return tokens > tokenBudget;
}

// ── Step 1: Deduplication ───────────────────────────────────────────────────

function deduplicateRules(rules) {
  const seen = new Map();

  for (const rule of rules) {
    const normalized = normalizeForComparison(rule.content);
    const existing = seen.get(normalized);

    if (!existing || (rule.confidence || 0) > (existing.confidence || 0)) {
      seen.set(normalized, rule);
    }
  }

  return [...seen.values()];
}

function normalizeForComparison(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Step 2: Abbreviation ────────────────────────────────────────────────────

const ABBREVIATIONS = [
  [/\bfor example\b/gi, 'e.g.'],
  [/\bin other words\b/gi, 'i.e.'],
  [/\bmake sure (to |that )?/gi, ''],
  [/\bplease\b/gi, ''],
  [/\byou should\b/gi, ''],
  [/\bit is important (to |that )?/gi, ''],
  [/\bwhen possible\b/gi, ''],
  [/\bas much as possible\b/gi, ''],
  [/\bin order to\b/gi, 'to'],
  [/\bwith the exception of\b/gi, 'except'],
  [/\btake into account\b/gi, 'consider'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bin the event that\b/gi, 'if'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
];

function abbreviateContent(text) {
  let result = text;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  // Clean up extra spaces
  return result.replace(/\s{2,}/g, ' ').trim();
}

// ── Step 3: Merge Related Rules ─────────────────────────────────────────────

function mergeRelatedRules(rules) {
  const byCategory = new Map();

  for (const rule of rules) {
    const cat = rule.category || 'general';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(rule);
  }

  const merged = [];
  for (const [category, catRules] of byCategory) {
    if (catRules.length <= 2) {
      merged.push(...catRules);
      continue;
    }

    // Find rules that can be merged (short, similar subject)
    const mergeable = [];
    const standalone = [];

    for (const rule of catRules) {
      if (rule.content.length < 80) {
        mergeable.push(rule);
      } else {
        standalone.push(rule);
      }
    }

    // Merge short rules into a combined rule if there are enough
    if (mergeable.length >= 3) {
      const combinedContent = mergeable.map(r => r.content).join('; ');
      const avgConfidence = mergeable.reduce((s, r) => s + (r.confidence || 0.5), 0) / mergeable.length;
      merged.push({
        content: combinedContent,
        category,
        source: 'merged',
        confidence: avgConfidence,
        name: `${category}-combined`,
      });
    } else {
      merged.push(...mergeable);
    }

    merged.push(...standalone);
  }

  return merged;
}

// ── Step 5: Condense Long Rules ─────────────────────────────────────────────

function condenseLongRules(rules, tokenBudget, cpt) {
  const targetTokensPerRule = Math.floor(tokenBudget / Math.max(1, rules.length));
  const targetCharsPerRule = targetTokensPerRule * cpt;

  return rules.map(rule => {
    if (rule.content.length <= targetCharsPerRule) return rule;

    // Truncate to target length at sentence boundary
    let truncated = rule.content.slice(0, targetCharsPerRule);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastSemicolon = truncated.lastIndexOf(';');
    const cutPoint = Math.max(lastPeriod, lastSemicolon);
    if (cutPoint > targetCharsPerRule * 0.5) {
      truncated = truncated.slice(0, cutPoint + 1);
    }

    return { ...rule, content: truncated.trim() };
  });
}

// ── Token Estimation ────────────────────────────────────────────────────────

function estimateTokensForRules(rules, cpt) {
  let total = 0;
  for (const rule of rules) {
    total += Math.ceil(rule.content.length / cpt);
  }
  return total;
}
