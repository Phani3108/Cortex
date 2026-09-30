import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mergeBullets, stripBullet, applyAdaptation, findRuleLocations } from '../../src/core/adapt.js';
import { gitRepo, tempDir, write, runCli } from './helpers.js';

const emptyPlan = () => ({
  timestamp: new Date().toISOString(),
  newRules: [], modifiedRules: [], removedRules: [], contextUpdates: [], profileUpdates: [], importedRules: [],
});

test('stripBullet removes single and doubled list markers', () => {
  assert.equal(stripBullet('- - Use tabs'), 'Use tabs');
  assert.equal(stripBullet('* 1. Use tabs'), 'Use tabs');
  assert.equal(stripBullet('Use tabs - always'), 'Use tabs - always');
});

test('mergeBullets preserves existing content and adds only new bullets', () => {
  const existing = '# User Corrections\n<!-- my note -->\n\n- Keep this one\n- User edited this\n';
  const merged = mergeBullets(existing, {
    title: 'User Corrections',
    sections: [{ heading: null, items: ['- - Keep this one', 'Brand new rule', 'brand  NEW rule'] }],
  });
  assert.deepEqual(merged.added, ['Brand new rule']);
  assert.equal(merged.content, '# User Corrections\n<!-- my note -->\n\n- Keep this one\n- User edited this\n- Brand new rule\n');
  assert.doesNotMatch(merged.content, /- - /);
});

test('mergeBullets inserts into matching sections and appends new ones', () => {
  const existing = '# Imported Rules\n\n## From claude\n- A rule from claude\n\n## Notes\nfree text\n';
  const merged = mergeBullets(existing, {
    title: 'Imported Rules',
    sections: [
      { heading: 'From claude', items: ['Another claude rule'] },
      { heading: 'From cursor', items: ['A cursor rule'] },
    ],
  });
  assert.equal(merged.content,
    '# Imported Rules\n\n## From claude\n- A rule from claude\n- Another claude rule\n\n## Notes\nfree text\n\n## From cursor\n- A cursor rule\n');
});

test('applyAdaptation appends to imported.md/corrections.md instead of overwriting', () => {
  const root = tempDir();
  const rules = join(root, '.cortex', 'rules');
  mkdirSync(rules, { recursive: true });
  writeFileSync(join(rules, 'corrections.md'), '# User Corrections\n- Old correction stays\n');
  writeFileSync(join(rules, 'imported.md'), '# Imported Rules\n\n## From claude\n- Old import stays\n');

  const plan = emptyPlan();
  plan.newRules.push({ content: '- New correction' });
  plan.importedRules.push({ content: 'New import', provider: 'claude' });
  const res = applyAdaptation(root, plan);

  const corrections = readFileSync(join(rules, 'corrections.md'), 'utf-8');
  assert.match(corrections, /- Old correction stays\n- New correction\n/);
  assert.doesNotMatch(corrections, /- - /);
  const imported = readFileSync(join(rules, 'imported.md'), 'utf-8');
  assert.match(imported, /- Old import stays\n- New import\n/);
  assert.equal(res.applied.length, 2);

  // Second run: nothing new → nothing applied, no extra history
  const historyBefore = readdirSync(join(root, '.cortex', 'history')).length;
  const again = applyAdaptation(root, plan);
  assert.equal(again.applied.length, 0);
  assert.equal(readdirSync(join(root, '.cortex', 'history')).length, historyBefore);
});

test('dry run writes nothing', () => {
  const root = tempDir();
  const plan = emptyPlan();
  plan.contextUpdates.push({ content: 'Use Vitest for testing.', category: 'testing' });
  const res = applyAdaptation(root, plan, { dry: true });
  assert.equal(res.applied[0].count, 1);
  assert.ok(!existsSync(join(root, '.cortex')));
});

test('removed rules are reported as suggestions with file:line, never deleted', () => {
  const root = tempDir();
  const rules = join(root, '.cortex', 'rules');
  write(rules, 'style.md', '# Style\n- Use semicolons everywhere please\n');
  const plan = emptyPlan();
  plan.removedRules.push({ content: '- Use semicolons everywhere please', source: 'CLAUDE.md' });
  const res = applyAdaptation(root, plan);
  assert.equal(res.applied.length, 0);
  assert.deepEqual(res.suggestedRemovals[0].locations, [{ file: join(rules, 'style.md'), line: 2 }]);
  assert.match(readFileSync(join(rules, 'style.md'), 'utf-8'), /Use semicolons/);
  assert.deepEqual(findRuleLocations(join(root, 'nope'), 'x'), []);
});

test('history is capped at 20 entries', () => {
  const root = tempDir();
  for (let i = 0; i < 25; i++) {
    const plan = emptyPlan();
    plan.newRules.push({ content: `Correction number ${i}` });
    applyAdaptation(root, plan);
  }
  const files = readdirSync(join(root, '.cortex', 'history'));
  assert.ok(files.length <= 20, `${files.length} history files`);
});

test('cortex learn: applies once, then "Context is up to date"; never writes the global profile', () => {
  const repo = gitRepo();
  const home = tempDir('cortex-home-');
  write(home, '.cortex/profile.yaml', 'name: me\npatterns: []\n');
  write(repo, '.cortex/config.yaml', 'version: 1\n');
  write(repo, 'package.json', JSON.stringify({ devDependencies: { vitest: '1' } }));
  write(repo, 'CLAUDE.md', '# Mine\n- - Always write small focused functions\n');

  const first = runCli(repo, ['learn'], { home });
  assert.equal(first.code, 0, first.out);
  assert.match(readFileSync(join(repo, '.cortex/rules/imported.md'), 'utf-8'), /^- Always write small focused functions$/m);
  const state1 = readFileSync(join(repo, '.cortex/adaptations.yaml'), 'utf-8');
  assert.match(state1, /totalCycles: 1/);

  const second = runCli(repo, ['learn'], { home });
  assert.equal(second.code, 0);
  assert.match(second.out, /Context is up to date/);
  assert.equal(readFileSync(join(repo, '.cortex/adaptations.yaml'), 'utf-8'), state1);
  assert.equal(readdirSync(join(repo, '.cortex/history')).length, 1);

  assert.equal(readFileSync(join(home, '.cortex/profile.yaml'), 'utf-8'), 'name: me\npatterns: []\n');

  const session = JSON.parse(readFileSync(join(repo, '.cortex/session.json'), 'utf-8'));
  assert.ok(session.metrics.rulesEvolved >= 2);
  assert.ok(session.metrics.signalsCaptured >= 2);
});

test('cortex learn --auto --quiet prints nothing', () => {
  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', 'version: 1\n');
  write(repo, 'package.json', JSON.stringify({ devDependencies: { jest: '1' } }));
  const res = runCli(repo, ['learn', '--auto', '--quiet']);
  assert.equal(res.code, 0, res.out);
  assert.equal(res.out, '');
  assert.match(readFileSync(join(repo, '.cortex/rules/auto-detected.md'), 'utf-8'), /Use Jest/);
});
