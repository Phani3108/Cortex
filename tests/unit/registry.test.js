// Registry builder + lookups against a small synthetic OpenRouter catalog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistryFromOpenRouter, diffRegistries, classify } from '../../src/core/registry-build.js';
import { resolveModel } from '../../src/core/families.js';

const row = (id, prompt, completion, extra = {}) => ({ id, name: id, created: 1790000000, context_length: 1000000, pricing: { prompt: String(prompt), completion: String(completion) }, architecture: { output_modalities: ['text'] }, ...extra });

test('builds entries in $/1M, filters variants and non-text models', () => {
  const { registry } = buildRegistryFromOpenRouter({ data: [
    row('anthropic/claude-sonnet-5.5', 0.000002, 0.00001),
    row('anthropic/claude-sonnet-5.5:batch', 0.000001, 0.000005),
    row('openai/gpt-6.1-sol', 0.000002, 0.00001),
    row('google/gemini-3-pro-image', 0.000002, 0.000012),
    row('someone/else', 0.1, 0.1),
  ] }, { now: new Date('2026-09-30T00:00:00Z') });
  assert.deepEqual(Object.keys(registry.models).sort(), ['claude-sonnet-5.5', 'gpt-6.1-sol']);
  assert.deepEqual(registry.models['claude-sonnet-5.5'].costPer1M, { input: 2, output: 10 });
  assert.equal(registry.models['claude-sonnet-5.5'].apiId, 'claude-sonnet-5-5');
  assert.equal(registry.highlights.anthropic.sonnet, 'claude-sonnet-5.5');
});

test('diff reports additions and price changes; unchanged data keeps its timestamp', () => {
  const a = buildRegistryFromOpenRouter({ data: [row('openai/gpt-6.1-sol', 0.000002, 0.00001)] }, { now: new Date('2026-09-01') }).registry;
  const b = buildRegistryFromOpenRouter({ data: [row('openai/gpt-6.1-sol', 0.000003, 0.00001)] }, { now: new Date('2026-09-02'), previous: a });
  assert.equal(b.changes[0].type, 'price_change');
  const c = buildRegistryFromOpenRouter({ data: [row('openai/gpt-6.1-sol', 0.000003, 0.00001)] }, { now: new Date('2026-09-03'), previous: b.registry });
  assert.equal(c.changes.length, 0);
  assert.equal(c.registry.lastUpdated, b.registry.lastUpdated);
  assert.equal(diffRegistries(null, a)[0].type, 'initial');
});

test('model families resolve new naming schemes', () => {
  assert.deepEqual([resolveModel('claude-fable-5.1').tier, resolveModel('claude-opus-5-5').version], ['fable', '5.5']);
  assert.equal(resolveModel('gpt-6-luna').tier, 'luna');
  assert.equal(resolveModel('gemini-3.5-flash-lite').tier, 'flash-lite');
  assert.equal(resolveModel('anthropic/claude-sonnet-5.5').family, 'anthropic');
  assert.equal(classify('kimi-k3', 'moonshot').version, '3');
});
