import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  installHooks, removeHooks, checkHooks, addBlock, removeBlock, buildBlock,
  BLOCK_START, BLOCK_END,
} from '../../src/core/hooks.js';
import { gitRepo, git, tempDir, runCli } from './helpers.js';

test('install writes marked blocks, is idempotent, and status reports them', () => {
  const repo = gitRepo();
  const first = installHooks(repo);
  assert.equal(first.success, true);
  assert.deepEqual(first.installed.sort(), ['post-commit', 'pre-commit']);

  const pre = readFileSync(join(repo, '.git/hooks/pre-commit'), 'utf-8');
  assert.ok(pre.startsWith('#!/bin/sh'));
  assert.ok(pre.includes(BLOCK_START) && pre.includes(BLOCK_END));
  assert.match(pre, /git diff --cached --name-only -- \.cortex/);
  assert.match(pre, /compile --check --quiet/);
  assert.doesNotMatch(pre, /git add/);
  assert.ok(statSync(join(repo, '.git/hooks/pre-commit')).mode & 0o100);

  const post = readFileSync(join(repo, '.git/hooks/post-commit'), 'utf-8');
  assert.match(post, /learn --auto --quiet >\/dev\/null 2>&1 \|\| true/);
  assert.match(post, /command -v cortex/);
  assert.match(post, /npx --no-install cortex-aictx/);

  const again = installHooks(repo);
  assert.deepEqual(again.installed, []);
  assert.deepEqual(again.updated, []);
  assert.equal(readFileSync(join(repo, '.git/hooks/pre-commit'), 'utf-8'), pre);

  assert.deepEqual(checkHooks(repo).status, { 'post-commit': 'installed', 'pre-commit': 'installed' });
});

test('generated hook scripts are valid sh', () => {
  const repo = gitRepo();
  installHooks(repo);
  for (const name of ['pre-commit', 'post-commit']) {
    const res = runSh(['-n', join(repo, '.git/hooks', name)]);
    assert.equal(res, 0, `${name} has a syntax error`);
  }
});

test('coexists with an existing hook: inserted before trailing exit, removed exactly', () => {
  const repo = gitRepo();
  const hookPath = join(repo, '.git/hooks/pre-commit');
  const original = '#!/bin/sh\necho "lint"\nexit 0\n';
  writeFileSync(hookPath, original, { mode: 0o755 });

  installHooks(repo);
  const installed = readFileSync(hookPath, 'utf-8');
  assert.ok(installed.indexOf(BLOCK_END) < installed.indexOf('exit 0'), 'block must run before exit');
  assert.ok(installed.includes('echo "lint"'));

  const res = removeHooks(repo);
  assert.equal(res.success, true);
  assert.ok(res.removed.includes('pre-commit'));
  assert.equal(readFileSync(hookPath, 'utf-8'), original);
  assert.equal(checkHooks(repo).status['pre-commit'], 'not-installed');
});

test('remove only deletes the cortex span', () => {
  const block = buildBlock('post-commit');
  const content = `#!/bin/sh\necho before\n\n${block}\n\necho after\n`;
  assert.equal(removeBlock(content), '#!/bin/sh\necho before\n\necho after\n');
});

test('legacy (pre-marker) hooks are upgraded and removable', () => {
  const legacy = '#!/bin/sh\n# cortex-managed\n# old\nif command -v cortex >/dev/null 2>&1; then\n  cortex learn --auto --quiet 2>/dev/null || true\nfi\n';
  const upgraded = addBlock(legacy, buildBlock('post-commit'));
  assert.doesNotMatch(upgraded, /cortex-managed/);
  assert.ok(upgraded.includes(BLOCK_START));
  assert.equal(removeBlock(legacy), '#!/bin/sh\n');
});

test('works in a git worktree (.git is a file)', () => {
  const repo = gitRepo();
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
  const wt = join(tempDir(), 'wt');
  git(repo, 'worktree', 'add', '-q', wt);
  assert.ok(statSync(join(wt, '.git')).isFile());

  const res = installHooks(wt);
  assert.equal(res.success, true, res.error);
  assert.ok(existsSync(join(repo, '.git/hooks/pre-commit')));
  assert.equal(checkHooks(wt).status['pre-commit'], 'installed');
});

test('honours core.hooksPath', () => {
  const repo = gitRepo();
  git(repo, 'config', 'core.hooksPath', '.githooks');
  mkdirSync(join(repo, '.githooks'));
  const res = installHooks(repo);
  assert.equal(res.success, true);
  assert.ok(existsSync(join(repo, '.githooks/post-commit')));
});

test('non-git directory gives a clean error, not a stack trace', () => {
  const dir = tempDir();
  assert.equal(installHooks(dir).success, false);
  const cli = runCli(dir, ['hooks', 'install']);
  assert.equal(cli.code, 1);
  assert.match(cli.out, /Not a git repository/);
  assert.doesNotMatch(cli.out, /at .*\.js:\d+/);
});

test('pre-commit hook blocks only when .cortex/ is staged and compile --check fails', () => {
  const repo = gitRepo();
  installHooks(repo);
  // Fake `cortex` on PATH whose compile --check always fails
  const bin = tempDir();
  writeFileSync(join(bin, 'cortex'), '#!/bin/sh\n[ "$1" = compile ] && exit 3\nexit 0\n', { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

  writeFileSync(join(repo, 'a.txt'), 'x');
  git(repo, 'add', 'a.txt');
  assert.equal(runHook(repo, 'pre-commit', env).code, 0, 'unrelated commit must pass');

  mkdirSync(join(repo, '.cortex'));
  writeFileSync(join(repo, '.cortex/config.yaml'), 'version: 1\n');
  git(repo, 'add', '.cortex');
  const blocked = runHook(repo, 'pre-commit', env);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /stale — run 'cortex compile'/);
});

function runSh(args) {
  try {
    execFileSync('sh', args, { stdio: 'ignore' });
    return 0;
  } catch (err) {
    return err.status ?? 1;
  }
}

function runHook(repo, name, env) {
  const res = spawnSync('sh', [join(repo, '.git/hooks', name)], { cwd: repo, env, encoding: 'utf-8' });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}
