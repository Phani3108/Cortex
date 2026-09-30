// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Legacy programmatic API (v1). The real compiler is src/engine/compile.js;
 * these wrappers keep `formatForModel` / `compileForProvider` working.
 */

import { getFormatFamily } from './families.js';
import { formatRules, styleForFormatFamily, compile, resolveTargetId } from '../engine/index.js';

const toRule = r => ({ text: r.content ?? r.text, category: r.category || 'rules', label: r.category || 'rules', priority: r.priority || 'normal' });

/** Format rules [{ content, category }] for a model family. */
export function formatForModel(rules, modelHint = 'claude-sonnet') {
  return formatRules(rules.map(toRule), styleForFormatFamily(getFormatFamily(modelHint)));
}

/** Compile rules for one provider; returns that provider's always-on file content. */
export function compileForProvider(providerSlug, rules, modelHint) {
  const id = resolveTargetId(providerSlug) || providerSlug;
  const content = rules.map(r => `## ${r.category || 'rules'}\n- ${r.content ?? r.text}`).join('\n');
  const { outputs } = compile({
    ruleFiles: [{ path: 'rules.md', content }],
    config: { providers: { [id]: modelHint ? { enabled: true, model: modelHint } : true }, output: { agentsMd: 'duplicate' } },
  });
  return outputs.find(o => o.kind === 'instructions')?.content || '';
}
