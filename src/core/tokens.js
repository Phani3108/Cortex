/**
 * Token estimation for context files.
 *
 * Uses model-family-aware heuristics rather than a single ratio.
 * Real tokenizers would need tiktoken (OpenAI) or similar — we approximate
 * well enough for budget and cost estimation purposes.
 *
 * Calibrated against actual tokenizer counts for English source code:
 *   Claude (BPE):     ~3.5-4.5 chars/token for code
 *   GPT-4o (o200k):   ~3.8-4.3 chars/token for code
 *   Gemini (SentPiece): ~4.0-4.5 chars/token for code
 */

import { walkDir } from '../utils/fs.js';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

// Model-family-aware chars-per-token ratios (for English + code)
const CHARS_PER_TOKEN = {
  'claude':     3.8,  // Claude BPE tokenizer, tight on code
  'openai':     4.0,  // o200k_base, well-calibrated
  'gemini':     4.2,  // SentencePiece, slightly more generous
  'open-source': 3.5, // Llama/Mistral tokenizers, conservative
  'default':    4.0,  // Generic fallback
};

// Cost per 1M tokens (input) — 2026 pricing
const MODEL_COSTS = {
  // OpenAI
  'gpt-4o':          2.50,
  'gpt-4o-mini':     0.15,
  'gpt-4.1':         2.00,
  'gpt-4.1-mini':    0.40,
  'gpt-4.1-nano':    0.10,
  'o3':              2.00,
  'o3-mini':         1.10,
  'o4-mini':         1.10,
  // Anthropic
  'claude-opus':     15.00,
  'claude-sonnet':    3.00,
  'claude-haiku':     0.80,
  // Google
  'gemini-pro':       1.25,
  'gemini-flash':     0.075,
  'gemini-ultra':     7.00,
  // Open source (API hosting estimates)
  'llama':            0.20,
  'deepseek':         0.27,
  'mistral':          0.30,
  'codestral':        0.30,
  // Subscription (effectively free per query)
  'cursor':           0.00,
  'copilot':          0.00,
  'windsurf':         0.00,
};

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
 * Map a model name to its family for token estimation.
 */
export function getTokenFamily(modelName) {
  if (!modelName) return 'default';
  const lower = modelName.toLowerCase();
  if (lower.includes('claude') || lower.includes('haiku') || lower.includes('sonnet') || lower.includes('opus')) return 'claude';
  if (lower.includes('gpt') || lower.includes('o3') || lower.includes('o4')) return 'openai';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('llama') || lower.includes('deepseek') || lower.includes('mistral') || lower.includes('codestral') || lower.includes('qwen')) return 'open-source';
  return 'default';
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
 */
export function estimateCost(tokens, model = 'gpt-4o') {
  const costPer1M = MODEL_COSTS[model] ?? 2.50;
  return (tokens / 1_000_000) * costPer1M;
}

export function getModelCosts() {
  return { ...MODEL_COSTS };
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
