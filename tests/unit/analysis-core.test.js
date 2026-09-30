// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Unit tests for the analysis core modules: specs, budget helpers,
 * scoring / compress wrappers, tokens, tips.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TARGETS, TARGET_IDS } from '../../src/engine/targets.js';
import { PROVIDER_SPECS, getProviderSpec, listProviderSpecs, getModelFamily } from '../../src/core/specs.js';
import { getProviderModels, getHighlight } from '../../src/core/registry.js';
import { formatUSD, representativeModels, describeModel } from '../../src/core/budget.js';
import { scoreRules, optimizeForBudget } from '../../src/core/scoring.js';
import { compressRules, needsCompression } from '../../src/core/compress.js';
import { analyzeProject, getTokenFamily, estimateTokens } from '../../src/core/tokens.js';
import { generateTips } from '../../src/core/tips.js';
import { compareProviders } from '../../src/core/compare.js';

test('PROVIDER_SPECS is derived from TARGETS and the registry', () => {
  assert.deepEqual(Object.keys(PROVIDER_SPECS), TARGET_IDS);
  for (const id of TARGET_IDS) {
    const spec = getProviderSpec(id);
    assert.equal(spec.slug, id);
    assert.equal(spec.name, TARGETS[id].name);
    assert.equal(spec.contextFiles[0].path, TARGETS[id].mainFile);
    assert.deepEqual(spec.models, getProviderModels(id));
    assert.equal(spec.features.skills, !!TARGETS[id].skillsDir);
    assert.equal(spec.features.scopedRules, !!TARGETS[id].scopedPattern);
  }
  assert.equal(PROVIDER_SPECS.claude.tokenLimits.instructionBudget, null);
  assert.ok(PROVIDER_SPECS.openai.tokenLimits.instructionBudget > 0);
  assert.equal(listProviderSpecs().length, TARGET_IDS.length);
  assert.equal(getModelFamily('claude-sonnet-5.5').family, 'claude-family');
});

test('representative models come from registry highlights', () => {
  const reps = representativeModels();
  assert.ok(reps.length >= 3);
  assert.ok(reps.includes(getHighlight('anthropic', 'sonnet')));
  for (const id of reps) assert.equal(describeModel(id).estimated, false);
  assert.equal(describeModel('claude-sonnet-99').estimated, true);
});

test('formatUSD shows small amounts instead of "< $0.01"', () => {
  assert.equal(formatUSD(0), '$0');
  assert.equal(formatUSD(0.0024), '$0.0024');
  assert.equal(formatUSD(0.5), '$0.50');
  assert.equal(formatUSD(12.345), '$12.35');
  assert.equal(formatUSD(1234), '$1,234');
  assert.equal(formatUSD(0.00001), '<$0.0001');
});

test('scoring delegates to the engine and keeps critical rules', () => {
  const rules = [
    { text: 'Be nice.' },
    { text: 'Never commit `.env` files.', category: 'security', priority: 'critical' },
    { content: 'Prefer named exports in src/**/*.ts' },
  ];
  const scored = scoreRules(rules);
  assert.equal(scored[0].priority, 'critical');
  const fit = optimizeForBudget(scored, 0);
  assert.equal(fit.included.length, 1);
  const { compressed, stats } = compressRules(rules, 1);
  assert.ok(compressed.length >= 1);
  assert.ok(compressed.some(r => r.priority === 'critical'));
  assert.equal(stats.originalRules, 3);
  assert.equal(needsCompression(rules, 1_000_000), false);
});

test('analyzeProject honours include/exclude and skips .cortex and lockfiles', () => {
  const root = mkdtempSync(join(tmpdir(), 'cortex-analysis-core-'));
  try {
    for (const d of ['src', 'lib', '.cortex', 'src/gen']) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), 'x'.repeat(40));
    writeFileSync(join(root, 'src', 'gen', 'b.ts'), 'x'.repeat(40));
    writeFileSync(join(root, 'lib', 'c.js'), 'x'.repeat(40));
    writeFileSync(join(root, '.cortex', 'config.yaml'), 'x: 1');
    writeFileSync(join(root, 'package-lock.json'), '{}');
    writeFileSync(join(root, 'CLAUDE.md'), '# gen');
    const all = analyzeProject(root, {}, { skip: new Set(['CLAUDE.md']) });
    assert.equal(all.textFiles, 3);
    const src = analyzeProject(root, { include: ['src/'], exclude: ['src/gen/'] });
    assert.equal(src.textFiles, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('token helpers delegate to the engine', () => {
  assert.equal(getTokenFamily('claude-opus-5.5'), 'claude');
  assert.equal(getTokenFamily('gpt-6.1-sol'), 'openai');
  assert.equal(estimateTokens('x'.repeat(40), 'openai'), 10);
});

test('tips use TARGETS budgets', () => {
  const tips = generateTips('x'.repeat(4800), null, 'openai');
  assert.ok(tips.some(t => t.category === 'budget'));
  assert.equal(generateTips('short', null, 'claude').length, 0);
});

test('compareProviders reflects TARGETS', () => {
  const r = compareProviders('cursor', 'gemini', { enabled: ['cursor'] });
  assert.equal(r.scoping.lost, true);
  assert.equal(r.agentsMd.to, false);
  assert.ok(r.migrationSteps.some(s => s.includes('cortex compile -p gemini')));
  assert.ok(r.migrationSteps.some(s => s.includes('providers.gemini: true')));
});
