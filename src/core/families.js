// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Model Family Schema — future-proof model classification.
 *
 * Instead of hardcoding every model name, we define FAMILIES with:
 * - Regex patterns that match any version (current + future)
 * - Tokenizer family (stable across versions — Claude BPE doesn't change)
 * - Prompting strategy (stable across versions — XML for Claude, etc.)
 * - Tier definitions (opus/sonnet/haiku, pro/flash/ultra, etc.)
 *
 * This means gpt-5.1, claude-sonnet-4.6, gemini-3.3-flash all resolve
 * correctly without any code changes.
 */

import { classify } from './registry-build.js';

// ── Family Definitions ──────────────────────────────────────────────────────

export const MODEL_FAMILIES = {

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    // Matches: claude-sonnet-5.5, claude-opus-5-5, claude-fable-5.1, haiku, etc.
    pattern: /claude|anthropic|sonnet|opus|haiku|fable|mythos/i,
    tokenizer: 'claude-bpe',
    charsPerToken: 3.8,
    formatting: {
      useXmlTags: true,
      sectionMarkers: 'xml',
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'direct',
    },
    strengths: ['long_context', 'instruction_following', 'code_generation', 'analysis', 'agentic_workflows'],
    promptPattern: 'structured_xml',
    tips: {
      prefillResponse: true,
      useExamples: true,
      chainOfThought: true,
      avoidAmbiguity: true,
    },
    // Fallback typicals only — live prices come from registry/latest.json.
    tiers: {
      fable:  { role: 'frontier', costTrend: 'premium', typical: { costPer1M: 10.00, contextWindow: 1000000 } },
      opus:   { role: 'flagship', costTrend: 'premium', typical: { costPer1M: 4.00,  contextWindow: 1000000 } },
      sonnet: { role: 'balanced', costTrend: 'mid',     typical: { costPer1M: 2.00,  contextWindow: 1000000 } },
      haiku:  { role: 'fast',     costTrend: 'budget',  typical: { costPer1M: 1.00,  contextWindow: 200000 } },
    },
    defaultTier: 'sonnet',
    // Version pattern: claude-{tier}-{version} or claude-{version}-{tier}
  },

  'openai-gpt': {
    id: 'openai-gpt',
    name: 'OpenAI GPT',
    // Matches: gpt-4o, gpt-5.5, gpt-6.1-sol, gpt-6-luna, gpt-chat-latest, chatgpt, etc.
    pattern: /gpt-|gpt\d|chatgpt|codex/i,
    tokenizer: 'o200k_base',
    charsPerToken: 4.0,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'numbered',
      emphasisStyle: 'caps',
      instructionTone: 'system',
    },
    strengths: ['reasoning', 'code_generation', 'tool_use', 'structured_output'],
    promptPattern: 'system_prompt',
    tips: {
      leadingWords: true,
      completionBias: true,
      jsonMode: true,
    },
    tiers: {
      '':      { role: 'flagship', costTrend: 'mid',     typical: { costPer1M: 2.00,  contextWindow: 1050000 } },
      'astra': { role: 'frontier', costTrend: 'premium', typical: { costPer1M: 10.00, contextWindow: 1050000 } },
      'sol':   { role: 'flagship', costTrend: 'mid',     typical: { costPer1M: 2.00,  contextWindow: 1050000 } },
      'terra': { role: 'balanced', costTrend: 'mid',     typical: { costPer1M: 2.00,  contextWindow: 1050000 } },
      'luna':  { role: 'fast',     costTrend: 'cheap',   typical: { costPer1M: 0.10,  contextWindow: 1050000 } },
      'mini':  { role: 'fast',     costTrend: 'budget',  typical: { costPer1M: 0.75,  contextWindow: 400000 } },
      'nano':  { role: 'edge',     costTrend: 'cheap',   typical: { costPer1M: 0.20,  contextWindow: 400000 } },
    },
    defaultTier: '',
  },

  'openai-reasoning': {
    id: 'openai-reasoning',
    name: 'OpenAI Reasoning',
    // Matches: o1, o3, o4-mini, o5, o9-pro, etc.
    pattern: /^o[1-9]\d*(-mini|-pro)?$/i,
    tokenizer: 'o200k_base',
    charsPerToken: 4.0,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'numbered',
      emphasisStyle: 'caps',
      instructionTone: 'minimal',
    },
    strengths: ['deep_reasoning', 'math', 'complex_code', 'planning'],
    promptPattern: 'problem_statement',
    tips: {
      minimalInstructions: true,
      problemFocused: true,
      avoidChainOfThought: true,
    },
    tiers: {
      '':     { role: 'flagship', costTrend: 'mid',    typical: { costPer1M: 2.00, contextWindow: 200000 } },
      'mini': { role: 'fast',     costTrend: 'budget', typical: { costPer1M: 1.10, contextWindow: 200000 } },
      'pro':  { role: 'premium',  costTrend: 'premium',typical: { costPer1M: 15.00,contextWindow: 200000 } },
    },
    defaultTier: '',
  },

  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    // Matches: gemini-2.5-pro, gemini-3.0-flash, gemini-3.3-ultra, etc.
    pattern: /gemini/i,
    tokenizer: 'sentencepiece',
    charsPerToken: 4.2,
    formatting: {
      useXmlTags: true,
      sectionMarkers: 'markdown',
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'conversational',
    },
    strengths: ['large_context', 'multimodal', 'reasoning', 'long_documents'],
    promptPattern: 'detailed_markdown',
    tips: {
      contextFirst: true,
      explicitPlanning: true,
      selfCritique: true,
      scopeDefinition: true,
      consistentFormatting: true,
    },
    tiers: {
      'pro':        { role: 'flagship', costTrend: 'mid',     typical: { costPer1M: 2.00, contextWindow: 1048576 } },
      'flash':      { role: 'fast',     costTrend: 'budget',  typical: { costPer1M: 0.75, contextWindow: 1048576 } },
      'flash-lite': { role: 'edge',     costTrend: 'cheap',   typical: { costPer1M: 0.30, contextWindow: 1048576 } },
      'ultra':      { role: 'premium',  costTrend: 'premium', typical: { costPer1M: 7.00, contextWindow: 2000000 } },
    },
    defaultTier: 'pro',
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    pattern: /deepseek/i,
    tokenizer: 'deepseek-bpe',
    charsPerToken: 3.5,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'explicit',
    },
    strengths: ['code_generation', 'reasoning', 'math'],
    promptPattern: 'explicit_markdown',
    tips: {
      explicitConstraints: true,
      repeatCritical: true,
    },
    tiers: {
      '':       { role: 'flagship', costTrend: 'budget', typical: { costPer1M: 0.27, contextWindow: 128000 } },
      'coder':  { role: 'coding',   costTrend: 'budget', typical: { costPer1M: 0.27, contextWindow: 128000 } },
      'chat':   { role: 'chat',     costTrend: 'cheap',  typical: { costPer1M: 0.14, contextWindow: 128000 } },
    },
    defaultTier: '',
  },

  'meta-llama': {
    id: 'meta-llama',
    name: 'Meta Llama',
    pattern: /llama|meta-llama/i,
    tokenizer: 'llama-bpe',
    charsPerToken: 3.5,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'explicit',
    },
    strengths: ['code_generation', 'fast_inference'],
    promptPattern: 'explicit_markdown',
    tips: {
      shortContext: true,
      explicitConstraints: true,
      repeatCritical: true,
    },
    tiers: {
      '':      { role: 'flagship', costTrend: 'budget', typical: { costPer1M: 0.20, contextWindow: 128000 } },
      'scout': { role: 'fast',     costTrend: 'cheap',  typical: { costPer1M: 0.10, contextWindow: 128000 } },
    },
    defaultTier: '',
  },

  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    pattern: /mistral|codestral|mixtral|pixtral/i,
    tokenizer: 'mistral-bpe',
    charsPerToken: 3.5,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'explicit',
    },
    strengths: ['code_generation', 'multilingual', 'fast_inference'],
    promptPattern: 'explicit_markdown',
    tips: {
      shortContext: true,
      explicitConstraints: true,
    },
    tiers: {
      '':       { role: 'flagship', costTrend: 'budget', typical: { costPer1M: 0.30, contextWindow: 128000 } },
      'large':  { role: 'premium',  costTrend: 'mid',    typical: { costPer1M: 2.00, contextWindow: 128000 } },
      'small':  { role: 'fast',     costTrend: 'cheap',  typical: { costPer1M: 0.10, contextWindow: 32000  } },
    },
    defaultTier: '',
  },

  qwen: {
    id: 'qwen',
    name: 'Alibaba Qwen',
    pattern: /qwen/i,
    tokenizer: 'qwen-bpe',
    charsPerToken: 3.5,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'explicit',
    },
    strengths: ['code_generation', 'multilingual', 'long_context'],
    promptPattern: 'explicit_markdown',
    tips: {
      explicitConstraints: true,
      repeatCritical: true,
    },
    tiers: {
      '':       { role: 'flagship', costTrend: 'budget', typical: { costPer1M: 0.25, contextWindow: 128000 } },
      'coder':  { role: 'coding',   costTrend: 'budget', typical: { costPer1M: 0.25, contextWindow: 128000 } },
      'max':    { role: 'premium',  costTrend: 'mid',    typical: { costPer1M: 1.00, contextWindow: 1000000 } },
    },
    defaultTier: '',
  },

  cohere: {
    id: 'cohere',
    name: 'Cohere',
    pattern: /command-?r|cohere/i,
    tokenizer: 'cohere-bpe',
    charsPerToken: 4.0,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'numbered',
      emphasisStyle: 'bold',
      instructionTone: 'system',
    },
    strengths: ['rag', 'tool_use', 'multilingual'],
    promptPattern: 'system_prompt',
    tips: {
      preambleMode: true,
      documentTags: true,
    },
    tiers: {
      '':     { role: 'flagship', costTrend: 'mid',    typical: { costPer1M: 2.50, contextWindow: 128000 } },
      'plus': { role: 'premium',  costTrend: 'premium', typical: { costPer1M: 5.00, contextWindow: 128000 } },
    },
    defaultTier: '',
  },

  xai: {
    id: 'xai',
    name: 'xAI Grok',
    pattern: /grok|xai/i,
    tokenizer: 'grok-bpe',
    charsPerToken: 4.0,
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'numbered',
      emphasisStyle: 'caps',
      instructionTone: 'system',
    },
    strengths: ['reasoning', 'code_generation', 'real_time_knowledge'],
    promptPattern: 'system_prompt',
    tips: {
      directInstructions: true,
    },
    tiers: {
      '':     { role: 'flagship', costTrend: 'mid',   typical: { costPer1M: 3.00, contextWindow: 128000 } },
      'mini': { role: 'fast',     costTrend: 'budget', typical: { costPer1M: 0.30, contextWindow: 128000 } },
    },
    defaultTier: '',
  },

  // Open-weights challengers — same explicit-markdown prompting as other open models.
  moonshot: openFamily('moonshot', 'Moonshot Kimi', /kimi|moonshot/i, { '': 0.65, code: 0.67, thinking: 0.6 }, 262144),
  zhipu:    openFamily('zhipu', 'Z.ai GLM', /glm|zhipu|z-ai/i, { '': 1.4, flash: 0.15, flashx: 0.37, prime: 2.8, air: 0.13 }, 1048576),
  minimax:  openFamily('minimax', 'MiniMax', /minimax/i, { '': 0.3 }, 1048576),
};

function openFamily(id, name, pattern, tierCosts, contextWindow) {
  return {
    id, name, pattern,
    tokenizer: `${id}-bpe`,
    charsPerToken: 3.5,
    formatting: { useXmlTags: false, sectionMarkers: 'markdown', listStyle: 'dash', emphasisStyle: 'bold', instructionTone: 'explicit' },
    strengths: ['code_generation', 'agentic_workflows', 'long_context'],
    promptPattern: 'explicit_markdown',
    tips: { explicitConstraints: true, repeatCritical: true },
    tiers: Object.fromEntries(Object.entries(tierCosts).map(([t, c]) => [t, { role: t || 'flagship', costTrend: 'budget', typical: { costPer1M: c, contextWindow } }])),
    defaultTier: '',
  };
}

// ── Subscription Providers (no per-token cost) ──────────────────────────────

export const SUBSCRIPTION_PROVIDERS = new Set(['cursor', 'copilot', 'windsurf']);

// ── Family Detection ────────────────────────────────────────────────────────

/**
 * Resolve a model name to its family, tier, and version.
 *
 * Examples:
 *   "claude-sonnet-4.6"  → { family: 'anthropic', tier: 'sonnet', version: '4.6' }
 *   "gpt-5.1-mini"       → { family: 'openai-gpt', tier: 'mini', version: '5.1' }
 *   "o5-mini"            → { family: 'openai-reasoning', tier: 'mini', version: '5' }
 *   "gemini-3.3-flash"   → { family: 'gemini', tier: 'flash', version: '3.3' }
 *   "deepseek-v3-coder"  → { family: 'deepseek', tier: 'coder', version: '3' }
 *   "llama-4-scout"      → { family: 'meta-llama', tier: 'scout', version: '4' }
 *   "unknown-model"      → { family: 'unknown', tier: '', version: null }
 */
export function resolveModel(modelName) {
  if (!modelName) return { family: 'unknown', tier: '', version: null, familyDef: null };

  // Strip vendor prefixes ("anthropic/claude-…") and normalise hyphenated
  // versions ("claude-sonnet-5-5" → "claude-sonnet-5.5").
  const name = String(modelName).trim().toLowerCase()
    .replace(/^[a-z0-9-]+\//, '')
    .replace(/-(\d)-(\d)(?=$|-)/, '-$1.$2');

  for (const [id, fam] of Object.entries(MODEL_FAMILIES)) {
    if (!fam.pattern.test(name)) continue;
    const { tier, version } = classify(name, id);
    return { family: id, tier: tier || fam.defaultTier || '', version, familyDef: fam };
  }

  return { family: 'unknown', tier: '', version: null, familyDef: null };
}

/**
 * Get the formatting family slug used by the compiler.
 * Maps family IDs to the compiler's format functions.
 */
export function getFormatFamily(modelName) {
  const { family } = resolveModel(modelName);

  switch (family) {
    case 'anthropic':         return 'claude-family';
    case 'openai-gpt':        return 'openai-family';
    case 'openai-reasoning':  return 'reasoning-family';
    case 'gemini':            return 'gemini-family';
    case 'deepseek':
    case 'meta-llama':
    case 'mistral':
    case 'qwen':
    case 'moonshot':
    case 'zhipu':
    case 'minimax':           return 'open-source';
    case 'cohere':            return 'openai-family'; // Similar system prompt style
    case 'xai':               return 'openai-family';
    default:                  return 'openai-family'; // Safe default
  }
}

/**
 * Get the tokenizer family for chars-per-token estimation.
 * This is a family-level constant — doesn't change between model versions.
 */
export function getTokenizerFamily(modelName) {
  const { familyDef } = resolveModel(modelName);
  if (!familyDef) return 'default';

  // Map to the token estimation keys used by tokens.js
  switch (familyDef.id) {
    case 'anthropic':         return 'claude';
    case 'openai-gpt':
    case 'openai-reasoning':  return 'openai';
    case 'gemini':            return 'gemini';
    default:                  return 'open-source';
  }
}

/**
 * Get chars-per-token ratio for a model.
 */
export function getCharsPerToken(modelName) {
  const { familyDef } = resolveModel(modelName);
  return familyDef?.charsPerToken || 4.0;
}

/**
 * Get the prompting strategy for a model.
 */
export function getModelStrategy(modelName) {
  const resolved = resolveModel(modelName);
  if (!resolved.familyDef) {
    // Return safe defaults matching openai-family behavior
    return {
      family: 'unknown',
      formatting: { useXmlTags: false, sectionMarkers: 'markdown', listStyle: 'numbered', emphasisStyle: 'caps', instructionTone: 'system' },
      strengths: ['code_generation'],
      promptPattern: 'system_prompt',
      tips: {},
    };
  }

  const fam = resolved.familyDef;
  return {
    family: resolved.family,
    tier: resolved.tier,
    version: resolved.version,
    formatting: fam.formatting,
    strengths: fam.strengths,
    promptPattern: fam.promptPattern,
    tips: fam.tips,
  };
}

/**
 * Estimate cost for an unknown model by family + tier defaults.
 * Returns the typical cost for the tier, or a family average if tier unknown.
 */
export function estimateTierCost(modelName) {
  const { familyDef, tier } = resolveModel(modelName);
  if (!familyDef) return 2.50; // Conservative fallback

  const tierDef = familyDef.tiers[tier] || familyDef.tiers[familyDef.defaultTier] || Object.values(familyDef.tiers)[0];
  return tierDef?.typical?.costPer1M ?? 2.50;
}

/**
 * Estimate context window for an unknown model by family + tier.
 */
export function estimateContextWindow(modelName) {
  const { familyDef, tier } = resolveModel(modelName);
  if (!familyDef) return 128000;

  const tierDef = familyDef.tiers[tier] || familyDef.tiers[familyDef.defaultTier] || Object.values(familyDef.tiers)[0];
  return tierDef?.typical?.contextWindow ?? 128000;
}

/**
 * Get all known family IDs.
 */
export function listFamilies() {
  return Object.keys(MODEL_FAMILIES);
}

/**
 * Get a family definition by ID.
 */
export function getFamily(familyId) {
  return MODEL_FAMILIES[familyId] || null;
}
