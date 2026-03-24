// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rule Impact Scoring — quantifies each rule's value vs. token cost.
 *
 * Not all rules are equal. A rule that prevents a common mistake in every
 * file is worth 1000 tokens. A rule about a niche edge case used once
 * per month might not be worth 50 tokens in a tight budget.
 *
 * Scoring dimensions:
 * 1. Frequency   — How often does this rule apply? (files touched, git frequency)
 * 2. Specificity — How actionable/specific is it? (vague rules score low)
 * 3. Coverage    — How many providers benefit from it?
 * 4. Confidence  — Where did it come from? (user edit > auto-detected)
 * 5. Token cost  — How many tokens does this rule consume?
 *
 * Impact = (frequency × specificity × coverage × confidence) / tokenCost
 */

import { getCharsPerToken } from './families.js';

/**
 * Score a set of rules for a target model.
 *
 * @param {Array} rules       - Array of { content, source, category, confidence }
 * @param {string} modelName  - Target model for token cost
 * @param {object} context    - { projectFiles, gitPatterns, providers }
 * @returns {Array} Rules with scores, sorted by impact (high to low)
 */
export function scoreRules(rules, modelName = 'claude-sonnet-4', context = {}) {
  const cpt = getCharsPerToken(modelName);
  const { projectFiles = [], gitPatterns = [], providers = [] } = context;

  const scored = rules.map(rule => {
    const tokens = Math.ceil(rule.content.length / cpt);
    const frequency = scoreFrequency(rule, projectFiles, gitPatterns);
    const specificity = scoreSpecificity(rule);
    const coverage = scoreCoverage(rule, providers);
    const confidence = scoreConfidence(rule);
    const tokenCost = Math.max(1, tokens);

    const rawImpact = (frequency * specificity * coverage * confidence);
    const impact = rawImpact / tokenCost;

    return {
      ...rule,
      scores: {
        frequency,
        specificity,
        coverage,
        confidence,
        tokenCost: tokens,
        rawImpact: +rawImpact.toFixed(2),
        impact: +impact.toFixed(4),
      },
    };
  });

  // Sort by impact score (highest first)
  scored.sort((a, b) => b.scores.impact - a.scores.impact);

  return scored;
}

/**
 * Get a budget-optimized subset of rules that fits within a token limit.
 *
 * Uses a greedy algorithm: pick highest-impact rules first until budget is full.
 * This is the "knapsack" optimization that maximizes instruction value.
 *
 * @param {Array} scoredRules   - Output of scoreRules()
 * @param {number} tokenBudget  - Max tokens to use
 * @returns {object} { included, excluded, totalTokens, utilization }
 */
export function optimizeForBudget(scoredRules, tokenBudget) {
  const included = [];
  const excluded = [];
  let totalTokens = 0;

  for (const rule of scoredRules) {
    const cost = rule.scores.tokenCost;
    if (totalTokens + cost <= tokenBudget) {
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

/**
 * Generate a human-readable impact report.
 */
export function generateImpactReport(scoredRules) {
  const tiers = {
    high: scoredRules.filter(r => r.scores.impact >= 0.5),
    medium: scoredRules.filter(r => r.scores.impact >= 0.1 && r.scores.impact < 0.5),
    low: scoredRules.filter(r => r.scores.impact < 0.1),
  };

  const totalTokens = scoredRules.reduce((sum, r) => sum + r.scores.tokenCost, 0);
  const highTokens = tiers.high.reduce((sum, r) => sum + r.scores.tokenCost, 0);

  return {
    totalRules: scoredRules.length,
    totalTokens,
    tiers: {
      high: { count: tiers.high.length, tokens: highTokens },
      medium: { count: tiers.medium.length, tokens: tiers.medium.reduce((s, r) => s + r.scores.tokenCost, 0) },
      low: { count: tiers.low.length, tokens: tiers.low.reduce((s, r) => s + r.scores.tokenCost, 0) },
    },
    topRules: scoredRules.slice(0, 10).map(r => ({
      content: r.content.slice(0, 80) + (r.content.length > 80 ? '...' : ''),
      impact: r.scores.impact,
      tokens: r.scores.tokenCost,
      source: r.source || 'unknown',
    })),
    bottomRules: scoredRules.slice(-5).map(r => ({
      content: r.content.slice(0, 80) + (r.content.length > 80 ? '...' : ''),
      impact: r.scores.impact,
      tokens: r.scores.tokenCost,
      source: r.source || 'unknown',
    })),
  };
}

// ── Scoring Dimensions ──────────────────────────────────────────────────────

function scoreFrequency(rule, projectFiles, gitPatterns) {
  const content = rule.content.toLowerCase();
  let score = 0.5; // Base

  // Rules about universal patterns score higher
  const universalPatterns = [
    'error', 'test', 'import', 'type', 'function', 'class',
    'component', 'api', 'database', 'security', 'async',
  ];
  const matchedPatterns = universalPatterns.filter(p => content.includes(p));
  score += matchedPatterns.length * 0.1;

  // Rules about specific file types boost with project file matching
  const fileExtMatch = content.match(/\.(js|ts|py|tsx|jsx|css|html|rs|go)\b/);
  if (fileExtMatch && projectFiles.length > 0) {
    const ext = fileExtMatch[1];
    const matchingFiles = projectFiles.filter(f => f.endsWith(`.${ext}`));
    const ratio = matchingFiles.length / Math.max(1, projectFiles.length);
    score += ratio * 0.5;
  }

  // Category frequency boost
  if (rule.category) {
    const highFreqCategories = ['formatting', 'language', 'testing', 'linting', 'framework'];
    if (highFreqCategories.includes(rule.category)) score += 0.2;
  }

  return Math.min(1.0, score);
}

function scoreSpecificity(rule) {
  const content = rule.content;
  let score = 0.5;

  // Specific actionable patterns
  if (/use \w+|prefer \w+|always \w+|never \w+|must \w+/i.test(content)) score += 0.2;

  // Contains code patterns or file paths
  if (/`[^`]+`|\.[a-z]{2,4}\b|\/[a-z]+\//i.test(content)) score += 0.15;

  // Contains version or tool names
  if (/\d+\.\d+|vitest|jest|eslint|prettier|react|vue|next/i.test(content)) score += 0.15;

  // Penalize vague rules
  if (/^(be |try to |consider |maybe |generally )/i.test(content)) score -= 0.3;
  if (content.length < 15) score -= 0.2;

  return Math.max(0.1, Math.min(1.0, score));
}

function scoreCoverage(rule, providers) {
  if (providers.length === 0) return 0.5;

  // Most rules apply to all providers equally
  // Category-specific rules might not (e.g., MDC format only for Cursor)
  const content = rule.content.toLowerCase();

  if (/\bcursor\b|\.mdc\b/i.test(content)) return 0.3; // Cursor-specific
  if (/\bclaude\b|xml.?tag/i.test(content)) return 0.3;  // Claude-specific
  if (/\bcopilot\b/i.test(content)) return 0.3;

  // Universal rules get full coverage
  return Math.min(1.0, 0.3 + (providers.length / 9) * 0.7);
}

function scoreConfidence(rule) {
  const conf = rule.confidence;
  if (typeof conf === 'number') return conf;

  // Infer from source
  const source = (rule.source || '').toLowerCase();
  if (source.includes('user') || source.includes('manual')) return 0.95;
  if (source.includes('import')) return 0.85;
  if (source.includes('auto') || source.includes('detect')) return 0.7;
  if (source.includes('git')) return 0.6;

  return 0.5; // Unknown source
}
