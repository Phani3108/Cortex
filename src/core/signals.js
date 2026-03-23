// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Signal Capture — the feedback pipeline.
 *
 * AI tools don't have a "what worked" API. But they leave traces:
 *
 * 1. FILE EDITS — user edits compiled output → they're correcting us
 * 2. GIT HISTORY — diffs show what the AI produced and what stuck
 * 3. PROVIDER FILES — existing rules files are accumulated wisdom
 * 4. SESSION ARTIFACTS — some tools leave memory/history files
 * 5. PROJECT CONFIG — .eslintrc, tsconfig, etc. = implicit rules
 *
 * This module captures those signals into a unified format.
 */

import { join, basename, extname } from 'node:path';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { readFileSafe, getCortexDir } from '../utils/fs.js';

// ── Signal Types ────────────────────────────────────────────────────────────

const SIGNAL_TYPES = {
  USER_EDIT:       'user_edit',       // User modified a compiled output
  GIT_PATTERN:     'git_pattern',     // Pattern from git history
  PROVIDER_RULE:   'provider_rule',   // Existing rule in a provider file
  PROJECT_CONFIG:  'project_config',  // Implicit rule from project config
  STYLE_SIGNAL:    'style_signal',    // Code style detected from source
  CORRECTION:      'correction',      // User corrected AI output
};

// ── Main Capture Functions ──────────────────────────────────────────────────

/**
 * Run the full signal capture pipeline on a project.
 * Returns a structured signal report.
 */
export function captureSignals(projectRoot) {
  const signals = [];

  signals.push(...captureProviderEdits(projectRoot));
  signals.push(...captureProjectConfigs(projectRoot));
  signals.push(...captureGitPatterns(projectRoot));
  signals.push(...captureStyleSignals(projectRoot));
  signals.push(...captureExistingRules(projectRoot));

  // Deduplicate by content hash
  const seen = new Set();
  const unique = signals.filter(s => {
    const key = `${s.type}:${s.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    capturedAt: new Date().toISOString(),
    projectRoot,
    totalSignals: unique.length,
    byType: groupBy(unique, 'type'),
    signals: unique,
  };
}

// ── 1. Provider File Edits ──────────────────────────────────────────────────
// If user edited CLAUDE.md after we compiled it, they're teaching us.

function captureProviderEdits(projectRoot) {
  const signals = [];
  const cortexDir = getCortexDir(projectRoot);

  // Track which files we compiled (via a manifest)
  const manifestPath = join(cortexDir, '.compile-manifest.json');
  if (!existsSync(manifestPath)) return signals;

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch { return signals; }

  for (const entry of manifest.files || []) {
    if (!existsSync(entry.path)) continue;

    const current = readFileSync(entry.path, 'utf-8');
    if (current !== entry.compiledContent) {
      // User modified this file after compile!
      const diff = extractMeaningfulDiff(entry.compiledContent, current);
      for (const added of diff.added) {
        signals.push({
          type: SIGNAL_TYPES.USER_EDIT,
          source: entry.path,
          provider: entry.provider,
          content: added,
          confidence: 0.9, // High — direct user edit
          action: 'add_to_rules',
        });
      }
      for (const removed of diff.removed) {
        signals.push({
          type: SIGNAL_TYPES.CORRECTION,
          source: entry.path,
          provider: entry.provider,
          content: removed,
          confidence: 0.7,
          action: 'remove_from_rules',
        });
      }
    }
  }

  return signals;
}

// ── 2. Project Configs → Implicit Rules ─────────────────────────────────────

function captureProjectConfigs(projectRoot) {
  const signals = [];

  // ESLint
  for (const name of ['.eslintrc.json', '.eslintrc.js', '.eslintrc.yml', '.eslintrc', 'eslint.config.js', 'eslint.config.mjs']) {
    const path = join(projectRoot, name);
    if (existsSync(path)) {
      signals.push({
        type: SIGNAL_TYPES.PROJECT_CONFIG,
        source: name,
        content: `Project uses ESLint (${name}). Follow the linting rules defined there.`,
        confidence: 1.0,
        action: 'add_to_context',
        category: 'linting',
      });
      break;
    }
  }

  // TypeScript
  const tsconfig = join(projectRoot, 'tsconfig.json');
  if (existsSync(tsconfig)) {
    try {
      const raw = readFileSync(tsconfig, 'utf-8');
      const config = JSON.parse(raw);
      const strict = config?.compilerOptions?.strict;
      signals.push({
        type: SIGNAL_TYPES.PROJECT_CONFIG,
        source: 'tsconfig.json',
        content: `TypeScript project with ${strict ? 'strict' : 'non-strict'} mode. Use TypeScript for all new files.`,
        confidence: 1.0,
        action: 'add_to_context',
        category: 'language',
      });
    } catch { /* ignore */ }
  }

  // Prettier
  for (const name of ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js']) {
    if (existsSync(join(projectRoot, name))) {
      signals.push({
        type: SIGNAL_TYPES.PROJECT_CONFIG,
        source: name,
        content: `Project uses Prettier for formatting. Don't suggest formatting changes.`,
        confidence: 1.0,
        action: 'add_to_context',
        category: 'formatting',
      });
      break;
    }
  }

  // Testing framework
  const pkg = readPkg(projectRoot);
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.vitest) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'package.json', content: 'Use Vitest for testing.', confidence: 1.0, action: 'add_to_context', category: 'testing' });
    } else if (deps.jest) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'package.json', content: 'Use Jest for testing.', confidence: 1.0, action: 'add_to_context', category: 'testing' });
    } else if (deps.mocha) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'package.json', content: 'Use Mocha for testing.', confidence: 1.0, action: 'add_to_context', category: 'testing' });
    }

    // Package manager
    if (existsSync(join(projectRoot, 'pnpm-lock.yaml'))) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'pnpm-lock.yaml', content: 'Use pnpm as the package manager. Use `pnpm` commands, not npm or yarn.', confidence: 1.0, action: 'add_to_context', category: 'tooling' });
    } else if (existsSync(join(projectRoot, 'yarn.lock'))) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'yarn.lock', content: 'Use Yarn as the package manager.', confidence: 1.0, action: 'add_to_context', category: 'tooling' });
    } else if (existsSync(join(projectRoot, 'bun.lockb'))) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'bun.lockb', content: 'Use Bun as the package manager and runtime.', confidence: 1.0, action: 'add_to_context', category: 'tooling' });
    }

    // Framework-specific rules
    if (deps.next) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'package.json', content: 'Next.js project. Use App Router patterns. Prefer Server Components by default.', confidence: 0.8, action: 'add_to_context', category: 'framework' });
    }
    if (deps.react && !deps.next) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'package.json', content: 'React project. Use functional components and hooks.', confidence: 0.9, action: 'add_to_context', category: 'framework' });
    }
    if (deps.tailwindcss) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'package.json', content: 'Uses Tailwind CSS. Use utility classes instead of custom CSS.', confidence: 1.0, action: 'add_to_context', category: 'styling' });
    }
  }

  // Python specifics
  if (existsSync(join(projectRoot, 'pyproject.toml'))) {
    const content = readFileSafe(join(projectRoot, 'pyproject.toml')) || '';
    if (content.includes('ruff')) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'pyproject.toml', content: 'Use Ruff for Python linting and formatting.', confidence: 1.0, action: 'add_to_context', category: 'linting' });
    }
    if (content.includes('pytest')) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'pyproject.toml', content: 'Use pytest for testing.', confidence: 1.0, action: 'add_to_context', category: 'testing' });
    }
    if (content.includes('mypy') || content.includes('pyright')) {
      signals.push({ type: SIGNAL_TYPES.PROJECT_CONFIG, source: 'pyproject.toml', content: 'Project uses type checking. Add type annotations to all new code.', confidence: 1.0, action: 'add_to_context', category: 'language' });
    }
  }

  return signals;
}

// ── 3. Git History Patterns ─────────────────────────────────────────────────

function captureGitPatterns(projectRoot) {
  const signals = [];

  if (!existsSync(join(projectRoot, '.git'))) return signals;

  try {
    // Recent commit message patterns
    const log = execSync('git log --oneline -50 --no-merges 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (!log) return signals;

    const lines = log.split('\n');

    // Detect conventional commits
    const conventional = lines.filter(l => /^[a-f0-9]+ (feat|fix|chore|docs|style|refactor|test|perf|ci|build)\b/i.test(l));
    if (conventional.length > lines.length * 0.5) {
      signals.push({
        type: SIGNAL_TYPES.GIT_PATTERN,
        source: 'git log',
        content: 'Project uses conventional commits (feat:, fix:, chore:, etc.). Follow this convention.',
        confidence: 0.8,
        action: 'add_to_context',
        category: 'conventions',
      });
    }

    // Detect if tests are always included with features
    const testCommits = lines.filter(l => /test|spec/i.test(l));
    if (testCommits.length > lines.length * 0.3) {
      signals.push({
        type: SIGNAL_TYPES.GIT_PATTERN,
        source: 'git log',
        content: 'Project has strong testing culture. Always include tests with new features.',
        confidence: 0.7,
        action: 'add_to_context',
        category: 'testing',
      });
    }

    // Check for recent provider file changes (user correcting AI output)
    const providerFiles = [
      'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md',
      '.windsurfrules', 'AGENTS.md',
    ];
    for (const file of providerFiles) {
      try {
        const fileLog = execSync(`git log --oneline -5 -- "${file}" 2>/dev/null`, {
          cwd: projectRoot,
          encoding: 'utf-8',
          timeout: 3000,
        }).trim();

        if (fileLog) {
          const edits = fileLog.split('\n').length;
          if (edits >= 2) {
            signals.push({
              type: SIGNAL_TYPES.GIT_PATTERN,
              source: `git log -- ${file}`,
              content: `${file} has been edited ${edits} times. User is actively refining AI rules.`,
              confidence: 0.6,
              action: 'track_evolution',
              category: 'adaptation',
              meta: { file, editCount: edits },
            });
          }
        }
      } catch { /* ignore */ }
    }
  } catch { /* git not available */ }

  return signals;
}

// ── 4. Code Style Signals ───────────────────────────────────────────────────

function captureStyleSignals(projectRoot) {
  const signals = [];

  const sampleFiles = findSampleFiles(projectRoot, 10);
  if (sampleFiles.length === 0) return signals;

  let useSemicolons = 0;
  let noSemicolons = 0;
  let useSingleQuotes = 0;
  let useDoubleQuotes = 0;
  let indent2 = 0;
  let indent4 = 0;
  let indentTab = 0;
  let camelCase = 0;
  let snakeCase = 0;
  let arrowFunctions = 0;
  let regularFunctions = 0;
  let constDecl = 0;
  let letDecl = 0;
  let varDecl = 0;
  let totalLines = 0;
  let maxLineLength = 0;
  let longLines = 0; // > 100 chars
  let trailingCommas = 0;
  let noTrailingCommas = 0;

  for (const file of sampleFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      totalLines += lines.length;

      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

        // Semicolons (only count statement-like lines, not for/if/etc.)
        if (trimmed.endsWith(';')) useSemicolons++;
        else if (trimmed.length > 5 && !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
                 !trimmed.endsWith(',') && !trimmed.endsWith('(') && !trimmed.endsWith(':')) {
          noSemicolons++;
        }

        // Quote style (count string delimiters, excluding template literals)
        const singleMatches = trimmed.match(/(?<![\\])'(?:[^'\\]|\\.)*'/g);
        const doubleMatches = trimmed.match(/(?<![\\])"(?:[^"\\]|\\.)*"/g);
        if (singleMatches) useSingleQuotes += singleMatches.length;
        if (doubleMatches) useDoubleQuotes += doubleMatches.length;

        // Indentation detection
        if (line.length > 0 && line !== trimmed) {
          const leadingWhitespace = line.match(/^(\s+)/);
          if (leadingWhitespace) {
            const ws = leadingWhitespace[1];
            if (ws.includes('\t')) indentTab++;
            else if (ws.length % 4 === 0 && ws.length >= 4) indent4++;
            else if (ws.length % 2 === 0 && ws.length >= 2) indent2++;
          }
        }

        // Line length
        if (trimmed.length > maxLineLength) maxLineLength = trimmed.length;
        if (trimmed.length > 100) longLines++;

        // Naming convention detection (variable/function declarations)
        const varMatch = trimmed.match(/(?:const|let|var|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (varMatch) {
          const name = varMatch[1];
          if (name.includes('_') && name !== name.toUpperCase()) snakeCase++;
          else if (/[a-z][A-Z]/.test(name)) camelCase++;
        }

        // Arrow vs regular functions
        if (/=>/.test(trimmed)) arrowFunctions++;
        if (/\bfunction\b/.test(trimmed)) regularFunctions++;

        // const vs let vs var
        if (/\bconst\s/.test(trimmed)) constDecl++;
        if (/\blet\s/.test(trimmed)) letDecl++;
        if (/\bvar\s/.test(trimmed)) varDecl++;

        // Trailing commas in multi-line (rough heuristic)
        if (trimmed.endsWith(',') && !trimmed.includes('for')) trailingCommas++;
      }
    } catch { /* skip unreadable files */ }
  }

  if (totalLines < 30) return signals;

  // Emit signals based on findings
  const stmtLines = useSemicolons + noSemicolons;
  if (stmtLines > 20) {
    if (useSemicolons > noSemicolons * 2) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use semicolons at end of statements.', confidence: 0.7, action: 'add_to_context', category: 'style' });
    } else if (noSemicolons > useSemicolons * 2) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Do not use semicolons (project uses no-semicolon style).', confidence: 0.7, action: 'add_to_context', category: 'style' });
    }
  }

  if (useSingleQuotes + useDoubleQuotes > 10) {
    if (useSingleQuotes > useDoubleQuotes * 1.5) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use single quotes for strings.', confidence: 0.6, action: 'add_to_context', category: 'style' });
    } else if (useDoubleQuotes > useSingleQuotes * 1.5) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use double quotes for strings.', confidence: 0.6, action: 'add_to_context', category: 'style' });
    }
  }

  // Indentation
  const indentTotal = indent2 + indent4 + indentTab;
  if (indentTotal > 20) {
    if (indentTab > indent2 + indent4) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use tabs for indentation.', confidence: 0.8, action: 'add_to_context', category: 'style' });
    } else if (indent2 > indent4 * 1.5) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use 2-space indentation.', confidence: 0.7, action: 'add_to_context', category: 'style' });
    } else if (indent4 > indent2 * 1.5) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use 4-space indentation.', confidence: 0.7, action: 'add_to_context', category: 'style' });
    }
  }

  // Naming convention
  if (camelCase + snakeCase > 10) {
    if (camelCase > snakeCase * 2) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use camelCase for variable and function names.', confidence: 0.7, action: 'add_to_context', category: 'style' });
    } else if (snakeCase > camelCase * 2) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Use snake_case for variable and function names.', confidence: 0.7, action: 'add_to_context', category: 'style' });
    }
  }

  // Arrow functions vs regular
  if (arrowFunctions + regularFunctions > 10) {
    if (arrowFunctions > regularFunctions * 3) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Prefer arrow functions over function declarations.', confidence: 0.6, action: 'add_to_context', category: 'style' });
    }
  }

  // const preference
  if (constDecl + letDecl + varDecl > 10) {
    if (varDecl > constDecl) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Project uses var declarations (legacy style).', confidence: 0.5, action: 'add_to_context', category: 'style' });
    } else if (constDecl > letDecl * 2 && varDecl === 0) {
      signals.push({ type: SIGNAL_TYPES.STYLE_SIGNAL, source: 'code_analysis', content: 'Prefer const over let. Never use var.', confidence: 0.7, action: 'add_to_context', category: 'style' });
    }
  }

  return signals;
}

// ── 5. Existing Provider Rules (reverse-import) ─────────────────────────────

function captureExistingRules(projectRoot) {
  const signals = [];

  // Scan existing provider files for rules we should know about
  const providerFiles = [
    { path: 'CLAUDE.md', provider: 'claude' },
    { path: '.cursorrules', provider: 'cursor' },
    { path: '.github/copilot-instructions.md', provider: 'copilot' },
    { path: '.windsurfrules', provider: 'windsurf' },
    { path: 'AGENTS.md', provider: 'codex' },
  ];

  for (const { path, provider } of providerFiles) {
    const fullPath = join(projectRoot, path);
    if (!existsSync(fullPath)) continue;

    // Check if this was generated by us (has our marker)
    const content = readFileSync(fullPath, 'utf-8');
    if (content.includes('Auto-generated by') && content.includes('Cortex')) continue; // Skip our own output

    // This is a user-created file — it's pure gold
    const rules = extractRulesFromMarkdown(content);
    for (const rule of rules) {
      signals.push({
        type: SIGNAL_TYPES.PROVIDER_RULE,
        source: path,
        provider,
        content: rule,
        confidence: 0.95, // Very high — user explicitly wrote this
        action: 'import_as_rule',
      });
    }
  }

  return signals;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractMeaningfulDiff(original, current) {
  const origLines = new Set(original.split('\n').map(l => l.trim()).filter(Boolean));
  const currLines = current.split('\n').map(l => l.trim()).filter(Boolean);

  const added = currLines.filter(l => !origLines.has(l) && l.length > 10 && !l.startsWith('#') && !l.startsWith('>'));
  const removed = [...origLines].filter(l => !currLines.includes(l) && l.length > 10 && !l.startsWith('#') && !l.startsWith('>'));

  return { added, removed };
}

function extractRulesFromMarkdown(content) {
  const rules = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Extract bullet points that look like rules/instructions
    if (trimmed.startsWith('- ') && trimmed.length > 15 && trimmed.length < 300) {
      // Filter out content that looks like headers, links, or metadata
      if (!/^\- \[|^\- http|^\- \*\*[A-Z].*:$/.test(trimmed)) {
        rules.push(trimmed.slice(2));
      }
    }
  }

  return rules;
}

function readPkg(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
  } catch { return null; }
}

function findSampleFiles(root, count) {
  const files = [];
  const exts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rs', '.go'];

  try {
    const scanDir = (dir, depth = 0) => {
      if (depth > 3 || files.length >= count) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full, depth + 1);
        } else if (exts.includes(extname(entry.name))) {
          files.push(full);
          if (files.length >= count) return;
        }
      }
    };
    scanDir(root);
  } catch { /* ignore */ }

  return files;
}

function groupBy(arr, key) {
  const groups = {};
  for (const item of arr) {
    const k = item[key];
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

export { SIGNAL_TYPES };
