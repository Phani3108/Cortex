/**
 * Model-Aware Context Compiler.
 *
 * Different models respond differently to the same instructions.
 * This module formats rules optimally for each model family,
 * respecting provider token budgets.
 *
 * Claude: prefers XML-structured, direct imperatives
 * GPT-4o: prefers system-prompt style, numbered lists
 * Gemini: benefits from detailed markdown, more context
 * Open source: needs explicit, unambiguous instructions
 */

import { getModelFamily, PROVIDER_SPECS } from './specs.js';
import { estimateTokens, getTokenFamily } from './tokens.js';

/**
 * Format a set of rules for a specific model family.
 *
 * @param {Array} rules - Array of { content, source, category }
 * @param {string} modelHint - Model name (e.g., 'claude-sonnet', 'gpt-4o')
 * @param {object} options - { maxTokens, includeMetadata }
 * @returns {string} Formatted instructions
 */
export function formatForModel(rules, modelHint = 'claude-sonnet', options = {}) {
  const family = getModelFamily(modelHint);
  const { maxTokens = null } = options;

  switch (family.family) {
    case 'claude-family':
      return formatClaude(rules, maxTokens, modelHint);
    case 'openai-family':
      return formatOpenAI(rules, maxTokens, modelHint);
    case 'reasoning-family':
      return formatReasoning(rules, maxTokens, modelHint);
    case 'gemini-family':
      return formatGemini(rules, maxTokens, modelHint);
    case 'open-source':
      return formatOpenSource(rules, maxTokens, modelHint);
    default:
      return formatGenericMarkdown(rules, maxTokens, modelHint);
  }
}

// ── Claude Format ───────────────────────────────────────────────────────────
// Claude responds well to XML structure and direct imperatives.

function formatClaude(rules, maxTokens, modelHint) {
  const sections = groupByCategory(rules);
  const parts = [];

  for (const [category, items] of Object.entries(sections)) {
    parts.push(`<${category}>`);
    for (const rule of items) {
      parts.push(`- ${rule.content}`);
    }
    parts.push(`</${category}>`);
    parts.push('');
  }

  let output = parts.join('\n');
  if (maxTokens) output = truncateToTokenBudget(output, maxTokens, modelHint);
  return output;
}

// ── OpenAI Format ───────────────────────────────────────────────────────────
// GPT models prefer numbered lists with clear section headers.

function formatOpenAI(rules, maxTokens, modelHint) {
  const sections = groupByCategory(rules);
  const parts = [];

  for (const [category, items] of Object.entries(sections)) {
    parts.push(`## ${capitalize(category)}`);
    parts.push('');
    items.forEach((rule, i) => {
      parts.push(`${i + 1}. ${rule.content}`);
    });
    parts.push('');
  }

  let output = parts.join('\n');
  if (maxTokens) output = truncateToTokenBudget(output, maxTokens, modelHint);
  return output;
}

// ── Gemini Format ───────────────────────────────────────────────────────────
// Gemini 2.5+ benefits from XML-style tags combined with detailed context.
// Structure: context first, then instructions, then constraints.

function formatGemini(rules, maxTokens, modelHint) {
  const sections = groupByCategory(rules);
  const parts = [];

  // Gemini works best with context provided first, instructions after
  const contextCategories = ['context', 'project', 'environment'];
  const ruleCategories = Object.keys(sections).filter(c => !contextCategories.includes(c));

  // Context sections first
  for (const cat of contextCategories) {
    if (!sections[cat]) continue;
    parts.push(`<${cat}>`);
    for (const rule of sections[cat]) {
      parts.push(`- ${rule.content}`);
    }
    parts.push(`</${cat}>`);
    parts.push('');
  }

  // Then rule/instruction sections
  for (const cat of ruleCategories) {
    parts.push(`## ${capitalize(cat)}`);
    parts.push('');
    for (const rule of sections[cat]) {
      parts.push(`- ${rule.content}`);
    }
    parts.push('');
  }

  let output = parts.join('\n');
  if (maxTokens) output = truncateToTokenBudget(output, maxTokens, modelHint);
  return output;
}

// ── Reasoning Model Format ──────────────────────────────────────────────────
// o1, o3, o4-mini — these do chain-of-thought internally.
// Provide the problem statement clearly, avoid over-scaffolding.

function formatReasoning(rules, maxTokens, modelHint) {
  const sections = groupByCategory(rules);
  const parts = [];

  parts.push('## Task Constraints');
  parts.push('');

  for (const [category, items] of Object.entries(sections)) {
    if (items.length === 1) {
      parts.push(`- **${capitalize(category)}**: ${items[0].content}`);
    } else {
      parts.push(`### ${capitalize(category)}`);
      for (const rule of items) {
        parts.push(`- ${rule.content}`);
      }
    }
    parts.push('');
  }

  let output = parts.join('\n');
  if (maxTokens) output = truncateToTokenBudget(output, maxTokens, modelHint);
  return output;
}

// ── Open Source Format ──────────────────────────────────────────────────────
// Llama, DeepSeek, etc. need more explicit instructions.

function formatOpenSource(rules, maxTokens, modelHint) {
  const sections = groupByCategory(rules);
  const parts = [];

  parts.push('IMPORTANT INSTRUCTIONS — Follow these rules strictly:');
  parts.push('');

  for (const [category, items] of Object.entries(sections)) {
    parts.push(`### ${capitalize(category)}`);
    parts.push('');
    for (const rule of items) {
      parts.push(`- ${rule.content}`);
    }
    parts.push('');
  }

  parts.push('Do not deviate from these rules.');

  let output = parts.join('\n');
  if (maxTokens) output = truncateToTokenBudget(output, maxTokens, modelHint);
  return output;
}

// ── Generic Markdown ────────────────────────────────────────────────────────

function formatGenericMarkdown(rules, maxTokens, modelHint) {
  const sections = groupByCategory(rules);
  const parts = [];

  for (const [category, items] of Object.entries(sections)) {
    parts.push(`## ${capitalize(category)}`);
    parts.push('');
    for (const rule of items) {
      parts.push(`- ${rule.content}`);
    }
    parts.push('');
  }

  let output = parts.join('\n');
  if (maxTokens) output = truncateToTokenBudget(output, maxTokens, modelHint);
  return output;
}

// ── Budget-Aware Compilation ────────────────────────────────────────────────

/**
 * Compile rules for a specific provider, respecting its token budget.
 *
 * Priority order (highest first):
 * 1. User corrections (confidence >= 0.9)
 * 2. Imported rules from existing provider files (confidence >= 0.9)
 * 3. Auto-detected project configs (confidence >= 0.8)
 * 4. Style signals (confidence >= 0.6)
 * 5. Git patterns (confidence >= 0.6)
 */
export function compileForProvider(providerSlug, rules, modelHint) {
  const spec = PROVIDER_SPECS[providerSlug];
  if (!spec) return formatGenericMarkdown(rules, null, modelHint);

  const budget = spec.tokenLimits?.instructionBudget || null;
  const model = modelHint || spec.models[0];

  // Sort by confidence (highest priority first)
  const sorted = [...rules].sort((a, b) => (b.confidence || 0.5) - (a.confidence || 0.5));

  return formatForModel(sorted, model, { maxTokens: budget });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function groupByCategory(rules) {
  const groups = {};
  for (const rule of rules) {
    const cat = rule.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(rule);
  }
  return groups;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate text to fit within a token budget.
 * Uses model-family-aware token estimation.
 * Cuts at line boundaries to avoid breaking markdown structure.
 */
function truncateToTokenBudget(text, maxTokens, modelHint) {
  const family = getTokenFamily(modelHint);
  const currentTokens = estimateTokens(text, family);
  if (currentTokens <= maxTokens) return text;

  const lines = text.split('\n');
  const kept = [];
  let runningTokens = 0;
  // Reserve a small budget for the truncation notice
  const usableBudget = maxTokens - 20;

  for (const line of lines) {
    const lineTokens = estimateTokens(line + '\n', family);
    if (runningTokens + lineTokens > usableBudget) break;
    kept.push(line);
    runningTokens += lineTokens;
  }

  kept.push('');
  kept.push('<!-- Truncated to fit token budget -->');
  return kept.join('\n');
}
