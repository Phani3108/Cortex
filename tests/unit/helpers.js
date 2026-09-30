// Shared helpers for hermetic unit tests: temp dirs, temp git repos, CLI runs.
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLI = join(ROOT, 'bin', 'cortex.js');

export function tempDir(prefix = 'cortex-test-') {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

export function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=Test', ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function gitRepo() {
  const dir = tempDir('cortex-repo-');
  git(dir, 'init', '-q');
  return dir;
}

export function write(root, rel, content) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

/** Run the CLI in cwd with an isolated HOME. */
export function runCli(cwd, args, { home } = {}) {
  const fakeHome = home || tempDir('cortex-home-');
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, CORTEX_HOME: join(fakeHome, '.cortex'), NO_COLOR: '1', FORCE_COLOR: '0' },
    timeout: 30000,
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '', out: (res.stdout || '') + (res.stderr || '') };
}

/** Temporarily point HOME at a temp dir for in-process calls. */
export function withTempHome() {
  const prev = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, CORTEX_HOME: process.env.CORTEX_HOME };
  const home = tempDir('cortex-home-');
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.CORTEX_HOME = join(home, '.cortex');
  return {
    home,
    restore() {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}
