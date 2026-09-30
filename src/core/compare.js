// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Comparisons behind `cortex switch` (model → model) and `cortex migrate`
 * (tool → tool). Models come from the registry, tools from engine TARGETS.
 */

import { TARGETS, styleForFormatFamily } from '../engine/index.js';
import { getFormatFamily } from './families.js';
import { findModel, getProviderModels } from './registry.js';
import { describeModel, tokensFromChars } from './budget.js';

// ── Model comparison ────────────────────────────────────────────────────────

/**
 * Compare two models for the same text.
 *
 * @param {string} fromModel
 * @param {string} toModel
 * @param {object} [options] - { chars: instruction chars, projectChars: project file chars }
 *                             (legacy: { projectTokens } is converted at 4 chars/token)
 */
export function compareModels(fromModel, toModel, options = {}) {
  const chars = options.chars ?? (options.compiledContent?.length || (options.projectTokens || 0) * 4);
  const projectChars = options.projectChars || 0;
  const a = describeModel(fromModel);
  const b = describeModel(toModel);

  const side = m => {
    const tokens = tokensFromChars(chars, m.tokenizer);
    const projectTokens = tokensFromChars(projectChars, m.tokenizer);
    return {
      model: m.id,
      name: m.name,
      family: m.family,
      tier: m.tier,
      estimated: m.estimated,
      basis: m.basis,
      tokens,
      projectTokens,
      contextWindow: m.contextWindow,
      maxOutput: findModel(m.name)?.maxOutput || null,
      inputPer1M: m.input,
      outputPer1M: m.output,
      cacheReadPer1M: m.cacheRead,
      per1kSessions: tokens * 1000 / 1e6 * (m.input || 0),
      style: styleForFormatFamily(getFormatFamily(m.name)),
    };
  };
  const from = side(a);
  const to = side(b);

  const pct = (x, y) => (x > 0 ? (y - x) / x * 100 : 0);
  const costChange = pct(from.inputPer1M || 0, to.inputPer1M || 0);
  const tokenChange = pct(from.tokens, to.tokens);

  const capabilities = [];
  const compareNum = (label, x, y) => {
    if (!x || !y || x === y) return;
    capabilities.push({ label, from: x, to: y, direction: y > x ? 'gained' : 'lost' });
  };
  compareNum('context window', from.contextWindow, to.contextWindow);
  compareNum('max output', from.maxOutput, to.maxOutput);

  return {
    from,
    to,
    tokenDelta: { from: from.tokens, to: to.tokens, change: `${tokenChange > 0 ? '+' : ''}${tokenChange.toFixed(1)}%` },
    costDelta: {
      fromPer1M: from.inputPer1M,
      toPer1M: to.inputPer1M,
      fromPer1kSessions: from.per1kSessions,
      toPer1kSessions: to.per1kSessions,
      change: `${costChange > 0 ? '+' : ''}${costChange.toFixed(1)}%`,
      direction: costChange > 0 ? 'more_expensive' : costChange < 0 ? 'cheaper' : 'same',
      estimated: from.estimated || to.estimated,
    },
    contextWindow: {
      from: from.contextWindow,
      to: to.contextWindow,
      fits: !to.contextWindow || to.tokens + to.projectTokens <= to.contextWindow,
    },
    capabilities,
    formatChange: { from: from.style, to: to.style, changed: from.style !== to.style },
    recompileNeeded: from.style !== to.style,
    sameFamilySwitch: a.family === b.family && a.family !== 'unknown',
  };
}

// ── Tool comparison ─────────────────────────────────────────────────────────

function filesOf(t) {
  return [t.mainFile, t.scopedPattern, t.skillsDir && `${t.skillsDir}/<name>/SKILL.md`].filter(Boolean);
}

function budgetLabel(b) {
  if (b.hard) return `${b.hard.toLocaleString('en-US')} ${b.unit} (hard limit)`;
  if (b.soft) return `~${b.soft.toLocaleString('en-US')} ${b.unit} (guidance)`;
  return 'none documented';
}

/**
 * Compare two tools.
 *
 * @param {string} fromId - engine target id
 * @param {string} toId
 * @param {object} [project] - { enabled: string[] } targets enabled in the project, for tailored steps
 */
export function compareProviders(fromId, toId, project = {}) {
  const from = TARGETS[fromId];
  const to = TARGETS[toId];
  if (!from || !to) return { error: `Unknown provider: ${from ? toId : fromId}` };

  const enabled = new Set(project.enabled || []);
  const fromModels = getProviderModels(fromId);
  const toModels = getProviderModels(toId);
  const agentsMdFor = t => t.id === 'codex' || t.readsAgentsMd;

  return {
    from: { id: fromId, slug: fromId, name: from.name },
    to: { id: toId, slug: toId, name: to.name },
    files: { from: filesOf(from), to: filesOf(to), removed: filesOf(from).filter(f => !filesOf(to).includes(f)), added: filesOf(to).filter(f => !filesOf(from).includes(f)) },
    scoping: { from: from.scoping, to: to.scoping, lost: !!from.scopedPattern && !to.scopedPattern },
    skills: { from: from.skillsDir, to: to.skillsDir },
    agentsMd: { from: agentsMdFor(from), to: agentsMdFor(to) },
    budget: { from: from.budget, to: to.budget, fromLabel: budgetLabel(from.budget), toLabel: budgetLabel(to.budget) },
    style: { from: from.style, to: to.style, changed: from.style !== to.style },
    models: {
      from: fromModels,
      to: toModels,
      gained: toModels.filter(m => !fromModels.includes(m)),
      lost: fromModels.filter(m => !toModels.includes(m)),
    },
    notes: to.notes,
    docs: to.docs,
    migrationSteps: migrationSteps(from, to, enabled),
  };
}

function migrationSteps(from, to, enabled) {
  const steps = [];
  if (!enabled.has(to.id)) steps.push(`Enable ${to.name}: set \`providers.${to.id}: true\` in .cortex/config.yaml`);
  const delegated = to.id !== 'codex' && to.readsAgentsMd && enabled.has('codex');
  steps.push(`Run \`cortex compile -p ${to.id}\` — writes ${delegated ? `${to.name}'s scoped rules and skills (always-on rules come from AGENTS.md)` : to.mainFile}`);
  if (to.budget.hard && !delegated) steps.push(`Run \`cortex optimize -p ${to.id}\` — ${to.name} reads at most ${to.budget.hard.toLocaleString('en-US')} ${to.budget.unit}; see which rules would be left out`);
  if (from.scopedPattern && !to.scopedPattern) steps.push(`Path-scoped rules become sections of ${to.mainFile} (${to.name} has no glob scoping)`);
  if (from.skillsDir && !to.skillsDir) steps.push(`${to.name} does not load Agent Skills — skills in .cortex/skills are not emitted for it`);
  if (from.id !== 'codex') {
    steps.push(`When you stop using ${from.name}: set \`providers.${from.id}: false\` and delete ${from.mainFile}${from.scopedPattern ? ` and ${from.scopedPattern.replace('{slug}', '*')}` : ''} (Cortex leaves a disabled tool's files in place)`);
  }
  steps.push('Run `cortex verify` to confirm every enabled tool is up to date');
  return steps;
}
