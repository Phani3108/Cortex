import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { validateName, skillTemplate, ruleTemplate } from '../../src/commands/add.js';
import { splitFrontmatter, parseRuleFile } from '../../src/engine/rules.js';
import { gitRepo, write, runCli } from './helpers.js';

test('validateName accepts safe names and lowercases', () => {
  assert.deepEqual(validateName('rule', 'Security'), { name: 'security' });
  assert.deepEqual(validateName('rule', 'api.v2_rules.md'), { name: 'api.v2_rules' });
  assert.deepEqual(validateName('skill', 'code-review'), { name: 'code-review' });
});

test('validateName rejects traversal and unsafe names', () => {
  for (const bad of ['../evil', '..', 'a/b', 'a\\b', '-flag', '.hidden', 'a b', '', 'x..y', '/abs']) {
    assert.ok(validateName('rule', bad).error, bad);
  }
  assert.ok(validateName('skill', 'my_skill').error, 'skills: hyphens only');
  assert.ok(validateName('skill', 'a'.repeat(65)).error, 'skills: max 64 chars');
});

test('skill template has Agent Skills frontmatter', () => {
  const { meta, body } = splitFrontmatter(skillTemplate('code-review'));
  assert.equal(meta.name, 'code-review');
  assert.ok(meta.description.length > 0 && meta.description.length <= 1024);
  assert.match(body, /## Instructions/);
});

test('rule template with globs has scope frontmatter the rule parser understands', () => {
  const content = ruleTemplate('react', ['src/**/*.tsx', 'app/*.ts']);
  const { meta } = splitFrontmatter(content);
  assert.deepEqual(meta.scope, ['src/**/*.tsx', 'app/*.ts']);
  const parsed = parseRuleFile(content, 'react.md');
  assert.deepEqual(parsed.rules[0].scope, ['src/**/*.tsx', 'app/*.ts']);
  assert.ok(!ruleTemplate('plain').startsWith('---'));
});

test('cortex add rule rejects path traversal with a clear error', () => {
  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', 'version: 1\n');
  const res = runCli(repo, ['add', 'rule', '../../evil']);
  assert.equal(res.code, 1);
  assert.match(res.out, /Invalid rule name/);
  assert.ok(!existsSync(join(dirname(repo), 'evil.md')));
  assert.ok(!existsSync(join(repo, 'evil.md')));
});

test('cortex add rule --glob writes scoped rule; add skill writes frontmatter skill', () => {
  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', 'version: 1\n');

  const rule = runCli(repo, ['add', 'rule', 'React', '--glob', 'src/**/*.tsx']);
  assert.equal(rule.code, 0, rule.out);
  const ruleText = readFileSync(join(repo, '.cortex/rules/react.md'), 'utf-8');
  assert.match(ruleText, /^---\nscope: \["src\/\*\*\/\*\.tsx"\]\n---\n/);

  const skill = runCli(repo, ['add', 'skill', 'code-review']);
  assert.equal(skill.code, 0, skill.out);
  const skillText = readFileSync(join(repo, '.cortex/skills/code-review.md'), 'utf-8');
  assert.match(skillText, /^---\nname: code-review\ndescription: .+\n---\n/);
  assert.deepEqual(readdirSync(join(repo, '.cortex/skills')), ['code-review.md']);
});
