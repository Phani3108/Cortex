// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Tips — a few concrete, checkable observations about a compiled
 * instruction file, keyed by target (from TARGETS) and model family.
 * Every number comes from TARGETS or the registry; nothing is hardcoded.
 *
 * Severities: critical (will misbehave), warning (likely suboptimal), info.
 */

import { TARGETS, measure } from '../engine/index.js';
import { resolveModel } from './families.js';
import { getContextWindow } from './registry.js';
import { tokensForModel, formatTokens } from './tokens.js';
import { defaultModelFor } from './specs.js';

/**
 * @param {string} content    - compiled instruction file text
 * @param {string} [modelName] - model the tool runs (defaults to the target's usual model)
 * @param {string} [targetId]  - engine target id
 * @param {object} [options]   - { rules: [{ text }] }
 * @returns {Array<{severity, category, message, action}>}
 */
export function generateTips(content, modelName, targetId, options = {}) {
  const tips = [];
  const text = String(content || '');
  const target = targetId ? TARGETS[targetId] : null;
  const model = modelName || (target ? defaultModelFor(target.id) : null);
  const { family } = resolveModel(model);

  // ── Target: budgets ─────────────────────────────────────────────────────
  if (target) {
    const { unit, soft, hard, note } = target.budget;
    const size = measure(text, unit);
    if (hard && size > hard * 0.9 && size <= hard) {
      tips.push({
        severity: 'warning',
        category: 'budget',
        message: `${target.mainFile} uses ${size}/${hard} ${unit} — close to ${target.name}'s hard limit.`,
        action: 'Move file-specific rules into scoped rule files before rules start being dropped.',
      });
    }
    if (soft && size > soft) {
      tips.push({ severity: 'warning', category: 'budget', message: `${size} ${unit} exceeds the ~${soft} ${unit} guidance. ${note}`, action: 'Trim or scope rules.' });
    }
  }

  // ── Model family ────────────────────────────────────────────────────────
  if (family === 'openai-reasoning' && /think step.?by.?step|chain.?of.?thought/i.test(text)) {
    tips.push({
      severity: 'warning',
      category: 'prompting',
      message: `${model} reasons internally; "think step by step" instructions add tokens without helping.`,
      action: 'Remove chain-of-thought instructions from rules.',
    });
  }

  // ── Context window share (registry numbers) ─────────────────────────────
  if (model && text) {
    const window = getContextWindow(model);
    const tokens = tokensForModel(text, model);
    if (window && tokens / window > 0.05) {
      tips.push({
        severity: 'warning',
        category: 'context',
        message: `~${formatTokens(tokens)} tokens of always-on instructions use ${(tokens / window * 100).toFixed(1)}% of ${model}'s ${formatTokens(window)}-token window every session.`,
        action: 'Move task-specific guidance into skills (loaded on demand).',
      });
    }
  }

  // ── Rule quality ────────────────────────────────────────────────────────
  const vague = (options.rules || []).filter(r => /^(be |try to |consider |maybe |generally |write (good|clean) code)/i.test(String(r.text || r.content || '').trim()));
  if (vague.length) {
    tips.push({
      severity: 'info',
      category: 'quality',
      message: `${vague.length} rule(s) are vague (e.g. "${String(vague[0].text || vague[0].content).slice(0, 50)}").`,
      action: 'Rewrite as concrete, checkable instructions.',
    });
  }

  return tips;
}

export function formatTipsForDisplay(tips) {
  if (!tips.length) return '';
  const icon = { critical: '✗', warning: '⚠', info: '·' };
  return tips.map(t => `    ${icon[t.severity] || '·'} ${t.message}\n      → ${t.action}`).join('\n');
}
