import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateSource, sourceSlug, safeBaseName, writeSyncedFiles } from '../../src/commands/sync.js';
import { gitRepo, tempDir, write, runCli } from './helpers.js';

test('validateSource accepts local and https only', () => {
  assert.equal(validateSource('local').kind, 'local');
  assert.equal(validateSource(undefined).kind, 'local');
  assert.deepEqual(validateSource('https://github.com/org/rules'), { kind: 'git', url: 'https://github.com/org/rules' });
  assert.equal(validateSource('https://example.com/x.git').kind, 'git');
  assert.equal(validateSource('https://raw.githubusercontent.com/o/r/main/rules.md').kind, 'http');

  for (const bad of [
    'http://example.com/a.md',
    'file:///etc/passwd',
    'ext::sh -c touch% /tmp/pwned',
    '/etc',
    '../../secret',
    '$(touch pwned)',
    'https://x/$(touch pwned)',
    'https://user:pass@example.com/r.md',
    '`id`',
  ]) {
    assert.equal(validateSource(bad).kind, 'invalid', bad);
  }
});

test('sourceSlug and safeBaseName produce filesystem-safe names', () => {
  assert.equal(sourceSlug('https://github.com/Org/AI-Rules.git'), 'org-ai-rules');
  assert.equal(sourceSlug('https://example.com/'), 'example-com');
  assert.equal(safeBaseName('Security.md'), 'security');
  assert.equal(safeBaseName('../../etc/passwd'), 'passwd');
  assert.equal(safeBaseName('..'), null);
  assert.equal(safeBaseName('...md'), null);
  assert.equal(safeBaseName(''), null);
  for (const n of ['a b.md', 'x;rm -rf.md', 'ünï.md']) {
    const out = safeBaseName(n);
    assert.ok(out === null || /^[a-z0-9][a-z0-9._-]*$/.test(out), n);
  }
});

test('writeSyncedFiles namespaces files and never touches hand-written rules', () => {
  const dir = join(tempDir(), 'rules');
  write(dir, 'security.md', '# mine\n- keep me\n');
  write(dir, 'synced-org-rules-hand.md', '# hand-written, no marker\n');

  const files = [
    { name: 'security.md', content: '---\nscope: ["src/**"]\n---\n- remote rule\n' },
    { name: '../../escape.md', content: '- nope' },
    { name: 'hand.md', content: '- remote' },
    { name: '..', content: 'x' },
  ];
  const res = writeSyncedFiles(dir, 'org-rules', files, 'https://github.com/org/rules');

  assert.equal(readFileSync(join(dir, 'security.md'), 'utf-8'), '# mine\n- keep me\n');
  const synced = readFileSync(join(dir, 'synced-org-rules-security.md'), 'utf-8');
  assert.ok(synced.startsWith('---\nscope: ["src/**"]\n---\n<!-- cortex:synced'), 'marker goes after frontmatter');
  assert.ok(existsSync(join(dir, 'synced-org-rules-escape.md')));
  assert.equal(readFileSync(join(dir, 'synced-org-rules-hand.md'), 'utf-8'), '# hand-written, no marker\n');
  assert.ok(res.some(r => r.status === 'skipped' && /not created by sync/.test(r.reason)));
  assert.ok(res.some(r => r.status === 'skipped' && /unsafe/.test(r.reason)));
  for (const f of readdirSync(dir)) assert.match(f, /^[a-z0-9][a-z0-9._-]*$/);

  // Re-sync overwrites only our own file
  writeSyncedFiles(dir, 'org-rules', [{ name: 'security.md', content: '- updated' }], 'https://github.com/org/rules');
  assert.match(readFileSync(join(dir, 'synced-org-rules-security.md'), 'utf-8'), /- updated/);
});

test('cortex sync rejects shell-injection sources without executing them and exits 1', () => {
  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', [
    'rules:',
    '  sources:',
    '    - local',
    '    - "$(touch pwned-a)"',
    '    - "https://x/$(touch pwned-b)"',
    '    - ../../etc',
    'skills:',
    '  sources: [local]',
    '',
  ].join('\n'));
  write(repo, '.cortex/rules/.keep', '');

  const res = runCli(repo, ['sync']);
  assert.equal(res.code, 1, res.out);
  assert.ok(!existsSync(join(repo, 'pwned-a')));
  assert.ok(!existsSync(join(repo, 'pwned-b')));
  assert.match(res.out, /failed/);
});

test('cortex sync with only local sources succeeds', () => {
  const repo = gitRepo();
  write(repo, '.cortex/config.yaml', 'rules:\n  sources:\n  - local\n');
  const res = runCli(repo, ['sync']);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /All sources are local/);
});
