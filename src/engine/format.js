// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Model-aware rule formatting. Same rules, rendered the way each model
 * family reads instructions best. Pure — shared by CLI and web playground.
 *
 *   xml        Claude     <code_style> … </code_style> blocks, direct imperatives
 *   markdown   neutral    ## Headings + bullets (AGENTS.md, Cursor, Copilot, Kiro…)
 *   numbered   GPT        ## Headings + numbered lists
 *   reasoning  o-series   one compact constraint list, minimal scaffolding
 *   gemini     Gemini     context sections first, then instructions
 *   explicit   open models "Follow these rules strictly" + repetition of criticals
 */

import { slugify } from './rules.js';

export const STYLES = ['xml', 'markdown', 'numbered', 'reasoning', 'gemini', 'explicit'];

/** Map a families.js format family to a style. */
export function styleForFormatFamily(formatFamily) {
  switch (formatFamily) {
    case 'claude-family': return 'xml';
    case 'openai-family': return 'numbered';
    case 'reasoning-family': return 'reasoning';
    case 'gemini-family': return 'gemini';
    case 'open-source': return 'explicit';
    default: return 'markdown';
  }
}

const CONTEXT_CATEGORIES = new Set(['context', 'project', 'environment', 'stack']);

export function titleCase(s) {
  const t = String(s || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'General';
}

/** Group rules by category, preserving first-seen order. */
export function groupRules(rules) {
  const groups = new Map();
  for (const r of rules) {
    const cat = r.category || 'general';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(r);
  }
  return groups;
}

/** Display label for a category: the author's heading text, first letter capitalised. */
function labelOf(cat, items) {
  return titleCase(items[0]?.label || cat);
}

function line(rule, style) {
  if (rule.priority !== 'critical') return rule.text;
  if (style === 'numbered' || style === 'explicit') return `${rule.text} (MANDATORY)`;
  if (style === 'reasoning') return rule.text;
  return `**${rule.text.replace(/\*\*/g, '')}**`;
}

/**
 * Render rules in a style.
 * @param {Array} rules  - [{ text, category, priority }]
 * @param {string} style - one of STYLES
 * @param {object} [opts] - { headingLevel = 2 }
 */
export function formatRules(rules, style = 'markdown', opts = {}) {
  if (!rules?.length) return '';
  const h = '#'.repeat(opts.headingLevel || 2);
  const groups = groupRules(rules);
  const out = [];

  if (style === 'xml') {
    for (const [cat, items] of groups) {
      const tag = slugify(cat).replace(/-/g, '_');
      out.push(`<${tag}>`);
      for (const r of items) out.push(`- ${line(r, style)}`);
      out.push(`</${tag}>`, '');
    }
  } else if (style === 'numbered') {
    for (const [cat, items] of groups) {
      out.push(`${h} ${labelOf(cat, items)}`, '');
      items.forEach((r, i) => out.push(`${i + 1}. ${line(r, style)}`));
      out.push('');
    }
  } else if (style === 'reasoning') {
    out.push(`${h} Constraints`, '');
    for (const [cat, items] of groups) {
      if (items.length === 1) out.push(`- **${labelOf(cat, items)}:** ${items[0].text}`);
      else for (const r of items) out.push(`- ${r.text}`);
    }
    out.push('');
  } else if (style === 'gemini') {
    const ordered = [...groups].sort(([a], [b]) => Number(CONTEXT_CATEGORIES.has(b)) - Number(CONTEXT_CATEGORIES.has(a)));
    for (const [cat, items] of ordered) {
      out.push(`${h} ${labelOf(cat, items)}`, '');
      for (const r of items) out.push(`- ${line(r, style)}`);
      out.push('');
    }
  } else if (style === 'explicit') {
    out.push('Follow these rules strictly. They override default behaviour.', '');
    for (const [cat, items] of groups) {
      out.push(`${h} ${labelOf(cat, items)}`, '');
      for (const r of items) out.push(`- ${line(r, style)}`);
      out.push('');
    }
    const critical = rules.filter(r => r.priority === 'critical');
    if (critical.length) {
      out.push(`${h} Non-negotiable`, '');
      for (const r of critical) out.push(`- ${r.text}`);
      out.push('');
    }
  } else {
    for (const [cat, items] of groups) {
      out.push(`${h} ${labelOf(cat, items)}`, '');
      for (const r of items) out.push(`- ${line(r, style)}`);
      out.push('');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
