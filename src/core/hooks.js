/**
 * Git Hooks — auto-learn on every commit.
 *
 * Installs a post-commit hook that runs `cortex learn --auto`
 * so the context evolves with every commit cycle.
 *
 * Also installs a pre-commit hook that re-compiles if .cortex/ changed,
 * ensuring provider files are always up to date.
 */

import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { findProjectRoot } from '../utils/fs.js';

const HOOK_MARKER = '# cortex-managed';

const POST_COMMIT_HOOK = `#!/bin/sh
${HOOK_MARKER}
# Auto-learn from AI session artifacts after each commit.
# Installed by: cortex hooks install
# Remove by: cortex hooks remove

if command -v cortex >/dev/null 2>&1; then
  cortex learn --auto --quiet 2>/dev/null || true
fi
`;

const PRE_COMMIT_HOOK = `#!/bin/sh
${HOOK_MARKER}
# Re-compile provider files if .cortex/ sources changed.
# Installed by: cortex hooks install
# Remove by: cortex hooks remove

if command -v cortex >/dev/null 2>&1; then
  # Check if any .cortex/ files are staged
  if git diff --cached --name-only | grep -q "^.cortex/"; then
    cortex compile --quiet 2>/dev/null || true
    # Stage the recompiled output files
    git add CLAUDE.md .cursorrules .windsurfrules AGENTS.md \\
      .cursor/rules/ .github/copilot-instructions.md \\
      .windsurf/rules/ .antigravity/ .gemini/ 2>/dev/null || true
  fi
fi
`;

/**
 * Install git hooks for auto-learning.
 */
export function installHooks(projectRoot) {
  const hooksDir = join(projectRoot, '.git', 'hooks');

  if (!existsSync(join(projectRoot, '.git'))) {
    return { success: false, error: 'Not a git repository' };
  }

  mkdirSync(hooksDir, { recursive: true });
  const installed = [];

  // Post-commit: auto-learn
  const postCommitPath = join(hooksDir, 'post-commit');
  const postCommitResult = installHook(postCommitPath, POST_COMMIT_HOOK);
  if (postCommitResult) installed.push('post-commit');

  // Pre-commit: auto-compile
  const preCommitPath = join(hooksDir, 'pre-commit');
  const preCommitResult = installHook(preCommitPath, PRE_COMMIT_HOOK);
  if (preCommitResult) installed.push('pre-commit');

  return { success: true, installed };
}

/**
 * Remove cortex git hooks.
 */
export function removeHooks(projectRoot) {
  const hooksDir = join(projectRoot, '.git', 'hooks');
  const removed = [];

  for (const hookName of ['post-commit', 'pre-commit']) {
    const hookPath = join(hooksDir, hookName);
    if (!existsSync(hookPath)) continue;

    const content = readFileSync(hookPath, 'utf-8');
    if (content.includes(HOOK_MARKER)) {
      // This is our hook — safe to remove the cortex section
      const cleaned = removeCortexSection(content);
      if (cleaned.trim()) {
        writeFileSync(hookPath, cleaned, 'utf-8');
      } else {
        // Hook was entirely ours — remove it
        writeFileSync(hookPath, '#!/bin/sh\n', 'utf-8');
      }
      removed.push(hookName);
    }
  }

  return { removed };
}

/**
 * Check if hooks are installed.
 */
export function checkHooks(projectRoot) {
  const hooksDir = join(projectRoot, '.git', 'hooks');
  const status = {};

  for (const hookName of ['post-commit', 'pre-commit']) {
    const hookPath = join(hooksDir, hookName);
    if (!existsSync(hookPath)) {
      status[hookName] = 'not-installed';
      continue;
    }

    const content = readFileSync(hookPath, 'utf-8');
    status[hookName] = content.includes(HOOK_MARKER) ? 'installed' : 'not-installed';
  }

  return status;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function installHook(hookPath, hookContent) {
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf-8');

    // Already installed
    if (existing.includes(HOOK_MARKER)) return false;

    // Append to existing hook
    writeFileSync(hookPath, existing + '\n' + hookContent, 'utf-8');
  } else {
    writeFileSync(hookPath, hookContent, 'utf-8');
  }

  chmodSync(hookPath, 0o755);
  return true;
}

function removeCortexSection(content) {
  const lines = content.split('\n');
  const result = [];
  let inCortexSection = false;

  for (const line of lines) {
    if (line.includes(HOOK_MARKER)) {
      inCortexSection = true;
      continue;
    }
    if (inCortexSection && (line.startsWith('#!') || line.trim() === '')) {
      // End of cortex section when we hit another shebang or blank line after content
      if (line.startsWith('#!')) {
        inCortexSection = false;
        result.push(line);
      }
      continue;
    }
    if (!inCortexSection) {
      result.push(line);
    }
  }

  return result.join('\n');
}
