// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Token estimation for context files.
 *
 * Uses model-family-aware heuristics rather than a single ratio.
 * Real tokenizers would need tiktoken (OpenAI) or similar — we approximate
 * well enough for budget and cost estimation purposes.
 *
 * Family classification is now handled by families.js (regex-based, future-proof).
 * Model pricing is in registry.js (auto-synced from remote).
 * This file retains the estimation math and project analysis.
 */

import { walkDir } from '../utils/fs.js';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { getTokenizerFamily, getCharsPerToken as familyCharsPerToken } from './families.js';
import { getModelCost, getAllModelCosts as registryAllModelCosts } from './registry.js';

// Model-family-aware chars-per-token ratios (for English + code)
// These are tokenizer-level constants — stable across model versions.
const CHARS_PER_TOKEN = {
  'claude':     3.8,  // Claude BPE tokenizer
  'openai':     4.0,  // o200k_base
  'gemini':     4.2,  // SentencePiece
  'open-source': 3.5, // Llama/Mistral/DeepSeek tokenizers
  'default':    4.0,  // Generic fallback
};

// MODEL_COSTS is no longer hardcoded — pricing comes from registry.js.
// This legacy export loads from the registry for backward compatibility.
function getLegacyModelCosts() {
  return registryAllModelCosts();
}

const TEXT_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.rs', '.go', '.java', '.kt', '.swift', '.cs',
  '.c', '.cpp', '.h', '.hpp',
  '.html', '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.mdx', '.txt', '.rst',
  '.sql', '.sh', '.bash', '.zsh', '.fish',
  '.vue', '.svelte', '.astro',
  '.env', '.gitignore', '.dockerignore',
  '.dockerfile', '.tf', '.hcl',
]);

/**
 * Estimate tokens for a string, optionally for a specific model family.
 */
export function estimateTokens(text, modelFamily = 'default') {
  const ratio = CHARS_PER_TOKEN[modelFamily] || CHARS_PER_TOKEN.default;
  return Math.ceil(text.length / ratio);
}

/**
 * Map a model name to its tokenizer family for token estimation.
 * Now delegates to families.js for future-proof regex-based resolution.
 * Any future model (gpt-5.1, claude-sonnet-4.6, gemini-3.3) resolves correctly.
 */
export function getTokenFamily(modelName) {
  if (!modelName) return 'default';
  const family = getTokenizerFamily(modelName);
  return CHARS_PER_TOKEN[family] ? family : 'default';
}

/**
 * Analyze a project directory for token costs.
 */
export function analyzeProject(projectRoot, config = {}) {
  const exclude = config.exclude || [];

  const files = walkDir(projectRoot);
  const results = {
    totalFiles: 0,
    totalSize: 0,
    totalTokens: 0,
    byExtension: {},
    largestFiles: [],
    textFiles: 0,
    binaryFiles: 0,
  };

  for (const file of files) {
    const ext = extname(file.path).toLowerCase();

    if (shouldExclude(file.relative, exclude)) continue;

    if (!TEXT_EXTENSIONS.has(ext) && ext !== '') {
      results.binaryFiles++;
      continue;
    }

    results.totalFiles++;
    results.totalSize += file.size;
    results.textFiles++;

    // Use default ratio for project-level estimates
    const tokens = Math.ceil(file.size / CHARS_PER_TOKEN.default);
    results.totalTokens += tokens;

    // By extension
    if (!results.byExtension[ext || '(no ext)']) {
      results.byExtension[ext || '(no ext)'] = { files: 0, tokens: 0, size: 0 };
    }
    results.byExtension[ext || '(no ext)'].files++;
    results.byExtension[ext || '(no ext)'].tokens += tokens;
    results.byExtension[ext || '(no ext)'].size += file.size;

    results.largestFiles.push({ path: file.relative, tokens, size: file.size });
  }

  // Sort largest files
  results.largestFiles.sort((a, b) => b.tokens - a.tokens);
  results.largestFiles = results.largestFiles.slice(0, 15);

  return results;
}

/**
 * Estimate cost for a given model.
 * Now powered by registry.js — supports any model, auto-synced pricing.
 */
export function estimateCost(tokens, model = 'gpt-4o') {
  const costPer1M = getModelCost(model);
  return (tokens / 1_000_000) * costPer1M;
}

export function getModelCosts() {
  return getLegacyModelCosts();
}

function shouldExclude(relativePath, patterns) {
  for (const pat of patterns) {
    const clean = pat.replace(/\*$/, '').replace(/\/$/, '');
    if (relativePath.startsWith(clean) || relativePath.includes(`/${clean}`)) return true;
    if (pat.startsWith('*.') && relativePath.endsWith(pat.slice(1))) return true;
  }
  return false;
}

/**
 * Format bytes for display.
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format token count for display.
 */
export function formatTokens(tokens) {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}
