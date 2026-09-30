// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Git Hooks — auto-learn on every commit, and zero drift on every commit.
 *
 * post-commit: runs `cortex learn --auto --quiet` (never blocks, never fails).
 * pre-commit:  when staged changes touch .cortex/, runs
 *              `cortex compile --check --quiet` and blocks the commit if the
 *              generated provider files are stale.
 *
 * Cortex's code lives between explicit markers so it can coexist with other
 * hook content and be removed cleanly:
 *
 *   # >>> cortex >>>
 *   ...
 *   # <<< cortex <<<
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const BLOCK_START = '# >>> cortex >>>';
export const BLOCK_END = '# <<< cortex <<<';
const LEGACY_MARKER = '# cortex-managed';
const HOOK_NAMES = ['post-commit', 'pre-commit'];

// Resolve the cortex binary: global install first, then a local (npx) install.
const RESOLVE_CORTEX = `if command -v cortex >/dev/null 2>&1; then
  cortex_cmd="cortex"
elif command -v npx >/dev/null 2>&1 && npx --no-install cortex-aictx --version >/dev/null 2>&1; then
  cortex_cmd="npx --no-install cortex-aictx"
else
  cortex_cmd=""
fi`;

const POST_COMMIT_BODY = `# Auto-learn from AI session artifacts. Remove with: cortex hooks remove
${RESOLVE_CORTEX}
if [ -n "$cortex_cmd" ]; then
  $cortex_cmd learn --auto --quiet >/dev/null 2>&1 || true
fi`;

const PRE_COMMIT_BODY = `# Block commits whose generated AI context files are stale. Remove with: cortex hooks remove
if [ -n "$(git diff --cached --name-only -- .cortex)" ]; then
${indent(RESOLVE_CORTEX, '  ')}
  if [ -n "$cortex_cmd" ]; then
    $cortex_cmd compile --check --quiet || {
      echo "cortex: generated AI context files are stale — run 'cortex compile'" >&2
      exit 1
    }
  fi
fi`;

const BODIES = { 'post-commit': POST_COMMIT_BODY, 'pre-commit': PRE_COMMIT_BODY };

export function buildBlock(hookName) {
  return `${BLOCK_START}\n${BODIES[hookName]}\n${BLOCK_END}`;
}

/**
 * Resolve the hooks directory via git so worktrees, submodules and
 * core.hooksPath all work. Returns { dir } or { error }.
 */
export function resolveHooksDir(projectRoot) {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return { error: 'Could not locate the git hooks directory' };
    return { dir: resolve(projectRoot, out) };
  } catch (err) {
    if (err.code === 'ENOENT') return { error: 'git is not installed or not on PATH' };
    return { error: 'Not a git repository (run `git init` first)' };
  }
}

/**
 * Install git hooks. Returns { success, installed, updated } or { success: false, error }.
 */
export function installHooks(projectRoot) {
  const { dir, error } = resolveHooksDir(projectRoot);
  if (error) return { success: false, error };

  const installed = [];
  const updated = [];
  try {
    mkdirSync(dir, { recursive: true });
    for (const hookName of HOOK_NAMES) {
      const hookPath = resolve(dir, hookName);
      const existing = existsSync(hookPath) ? readFileSync(hookPath, 'utf-8') : null;
      const next = addBlock(existing, buildBlock(hookName));
      if (next === existing) continue;
      writeFileSync(hookPath, next, 'utf-8');
      chmodSync(hookPath, 0o755);
      (existing !== null && hasCortex(existing) ? updated : installed).push(hookName);
    }
  } catch (err) {
    return { success: false, error: `Could not write hooks in ${dir}: ${err.message}` };
  }

  return { success: true, installed, updated, dir };
}

/**
 * Remove cortex blocks from git hooks, leaving any other content intact.
 */
export function removeHooks(projectRoot) {
  const { dir, error } = resolveHooksDir(projectRoot);
  if (error) return { success: false, error, removed: [] };

  const removed = [];
  try {
    for (const hookName of HOOK_NAMES) {
      const hookPath = resolve(dir, hookName);
      if (!existsSync(hookPath)) continue;
      const content = readFileSync(hookPath, 'utf-8');
      if (!hasCortex(content)) continue;
      writeFileSync(hookPath, removeBlock(content), 'utf-8');
      removed.push(hookName);
    }
  } catch (err) {
    return { success: false, error: `Could not update hooks in ${dir}: ${err.message}`, removed };
  }

  return { success: true, removed };
}

/**
 * Report whether each hook is installed. Returns { status, dir } or { error }.
 */
export function checkHooks(projectRoot) {
  const { dir, error } = resolveHooksDir(projectRoot);
  if (error) return { error };

  const status = {};
  for (const hookName of HOOK_NAMES) {
    const hookPath = resolve(dir, hookName);
    const content = existsSync(hookPath) ? readFileSync(hookPath, 'utf-8') : '';
    status[hookName] = hasCortex(content) ? 'installed' : 'not-installed';
  }
  return { status, dir };
}

// ── Pure text transforms (exported for tests) ──────────────────────────────

function hasCortex(content) {
  return content.includes(BLOCK_START) || content.includes(LEGACY_MARKER);
}

/**
 * Insert (or replace) the cortex block in a hook script. Inserted before a
 * trailing `exit` line so it still runs.
 */
export function addBlock(content, block) {
  if (content === null || content === undefined || !content.trim()) {
    return `#!/bin/sh\n\n${block}\n`;
  }

  if (content.includes(block)) return content; // already up to date

  const cleaned = removeBlock(content);
  const lines = cleaned.replace(/\n+$/, '').split('\n');
  let last = lines.length - 1;
  while (last >= 0 && (!lines[last].trim() || lines[last].trim().startsWith('#'))) last--;

  if (last > 0 && /^\s*exit(\s+\S+)?\s*(#.*)?$/.test(lines[last])) {
    lines.splice(last, 0, block);
    return lines.join('\n') + '\n';
  }
  return lines.join('\n') + '\n\n' + block + '\n';
}

/** Remove the marked cortex span (and legacy cortex sections). */
export function removeBlock(content) {
  let out = content;

  let start = out.indexOf(BLOCK_START);
  while (start !== -1) {
    const endIdx = out.indexOf(BLOCK_END, start);
    const end = endIdx === -1 ? out.length : endIdx + BLOCK_END.length;
    const before = out.slice(0, start);
    const after = out.slice(end).replace(/^\n+/, '');
    out = after.trim() ? before + after : before.replace(/\s+$/, '') + '\n';
    start = out.indexOf(BLOCK_START);
  }

  // Legacy (pre-marker) installs appended "#!/bin/sh\n# cortex-managed ..." to EOF
  const legacy = out.indexOf(LEGACY_MARKER);
  if (legacy !== -1) {
    let head = out.slice(0, legacy);
    head = head.replace(/#!\/bin\/sh\s*$/, '');
    out = head.replace(/\s+$/, '') + '\n';
  }

  // Nothing but a shebang left — keep a valid, no-op script
  if (!out.replace(/^#!.*\n?/, '').trim()) return '#!/bin/sh\n';
  return out;
}

function indent(text, pad) {
  return text.split('\n').map(l => (l ? pad + l : l)).join('\n');
}
