// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Token helpers for the CLI. Estimation itself lives in the pure engine
 * (src/engine/tokens.js); this module adds model-name lookups, pricing and
 * project scanning (which needs the file system).
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { estimateTokens as engineEstimate, tokenizerFor, formatTokens as engineFormat, CHARS_PER_TOKEN } from '../engine/tokens.js';
import { resolveModel } from './families.js';
import { getModelCost, getAllModelCosts, getHighlight } from './registry.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.rs', '.go', '.java', '.kt', '.swift', '.cs', '.php', '.scala', '.dart',
  '.c', '.cpp', '.h', '.hpp',
  '.html', '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.mdx', '.txt', '.rst',
  '.sql', '.sh', '.bash', '.zsh', '.fish',
  '.vue', '.svelte', '.astro',
  '.tf', '.hcl', '.graphql', '.proto',
]);

/** Directories never worth sending to a model. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.cortex', 'dist', 'build', 'coverage', '.next', '__pycache__', '.venv', 'venv', 'target', 'vendor']);

/** Machine-generated files: large, and never read as context. */
const GENERATED = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|go\.sum)$|\.(min\.js|min\.css|map|lock)$/;

/**
 * Estimate tokens for text. `tokenizer` is an engine bucket
 * ('claude' | 'openai' | 'gemini' | 'open-source' | 'default').
 */
export function estimateTokens(text, tokenizer = 'default') {
  return engineEstimate(text, CHARS_PER_TOKEN[tokenizer] ? tokenizer : 'default');
}

/** Tokenizer bucket for a model name (e.g. 'claude-sonnet-5.5' → 'claude'). */
export function getTokenFamily(modelName) {
  if (!modelName) return 'default';
  return tokenizerFor(resolveModel(modelName).family);
}

/** Tokens a model would see for `text`. */
export function tokensForModel(text, modelName) {
  return engineEstimate(text, getTokenFamily(modelName));
}

export const formatTokens = engineFormat;

/**
 * Scan project files that would plausibly be given to a model as context.
 *
 * @param {string} projectRoot
 * @param {object} [context] - config.context: { include: [...], exclude: [...] }
 * @param {object} [opts]    - { skip: Set<string> } project-relative paths to ignore (generated outputs)
 */
export function analyzeProject(projectRoot, context = {}, opts = {}) {
  const include = (context.include || []).map(cleanPattern).filter(Boolean);
  const exclude = context.exclude || [];
  const skip = opts.skip || new Set();

  const results = {
    totalFiles: 0,
    totalSize: 0,
    totalTokens: 0,
    byExtension: {},
    largestFiles: [],
    textFiles: 0,
    binaryFiles: 0,
    include,
  };

  for (const file of walk(projectRoot, '')) {
    if (skip.has(file.relative) || GENERATED.test(file.relative)) continue;
    if (include.length && !include.some(p => file.relative === p || file.relative.startsWith(`${p}/`))) continue;
    if (matchesAny(file.relative, exclude)) continue;

    const ext = extname(file.relative).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      results.binaryFiles++;
      continue;
    }

    const tokens = Math.ceil(file.size / CHARS_PER_TOKEN.default);
    results.totalFiles++;
    results.textFiles++;
    results.totalSize += file.size;
    results.totalTokens += tokens;

    const bucket = results.byExtension[ext] ||= { files: 0, tokens: 0, size: 0 };
    bucket.files++;
    bucket.tokens += tokens;
    bucket.size += file.size;
    results.largestFiles.push({ path: file.relative, tokens, size: file.size });
  }

  results.largestFiles.sort((a, b) => b.tokens - a.tokens);
  results.largestFiles = results.largestFiles.slice(0, 15);
  return results;
}

/** Input cost (USD) of `tokens` for a model; defaults to the newest Sonnet. */
export function estimateCost(tokens, model = getHighlight('anthropic', 'sonnet')) {
  return (tokens / 1_000_000) * (getModelCost(model) || 0);
}

/** modelName → input $/1M for every active registry model. */
export function getModelCosts() {
  return getAllModelCosts();
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function* walk(root, rel) {
  const dir = rel ? join(root, rel) : root;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(root, childRel);
    } else if (entry.isFile()) {
      let size = 0;
      try { size = statSync(join(root, childRel)).size; } catch { continue; }
      yield { relative: childRel, size };
    }
  }
}

function cleanPattern(p) {
  return String(p || '').trim().replace(/^\.\//, '').replace(/\/+$/, '').replace(/\/\*\*?$/, '');
}

/** Minimal matcher for config.context.exclude: "dir/", "name", "*.ext", "dir/**". */
function matchesAny(relative, patterns) {
  for (const raw of patterns) {
    const pat = String(raw || '').trim();
    if (!pat) continue;
    if (pat.startsWith('*.')) {
      if (relative.endsWith(pat.slice(1))) return true;
      continue;
    }
    const clean = cleanPattern(pat);
    if (!clean) continue;
    if (relative === clean || relative.startsWith(`${clean}/`) || relative.includes(`/${clean}/`) || relative.endsWith(`/${clean}`)) return true;
  }
  return false;
}

/** True when the project has at least one of the include paths. */
export function includeExists(projectRoot, include = []) {
  return include.map(cleanPattern).filter(Boolean).some(p => existsSync(join(projectRoot, p)));
}
