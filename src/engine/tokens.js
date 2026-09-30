// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Token estimation — pure, runs in Node and the browser.
 *
 * Cortex never ships a tokenizer (zero dependencies). Ratios below are
 * calibrated averages for English prose + code; they are estimates, and every
 * UI that shows them says so.
 */

export const CHARS_PER_TOKEN = {
  claude: 3.8,
  openai: 4.0,
  gemini: 4.2,
  'open-source': 3.5,
  default: 4.0,
};

/** Map a model family id (families.js) to a tokenizer bucket. */
export function tokenizerFor(family) {
  switch (family) {
    case 'anthropic': return 'claude';
    case 'openai-gpt':
    case 'openai-reasoning':
    case 'xai':
    case 'cohere': return 'openai';
    case 'gemini': return 'gemini';
    case undefined:
    case null:
    case 'unknown': return 'default';
    default: return 'open-source';
  }
}

export function estimateTokens(text, tokenizer = 'default') {
  if (!text) return 0;
  const ratio = CHARS_PER_TOKEN[tokenizer] || CHARS_PER_TOKEN.default;
  return Math.ceil(String(text).length / ratio);
}

/** UTF-8 byte length without Buffer (browser-safe). */
export function byteLength(text) {
  if (!text) return 0;
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return unescape(encodeURIComponent(text)).length;
}

/** Measure text in a budget's native unit. */
export function measure(text, unit, tokenizer = 'default') {
  if (unit === 'chars') return String(text || '').length;
  if (unit === 'bytes') return byteLength(text);
  if (unit === 'lines') return String(text || '').split('\n').length;
  return estimateTokens(text, tokenizer);
}

export function formatTokens(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
}
