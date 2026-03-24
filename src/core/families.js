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

// ── Family Definitions ──────────────────────────────────────────────────────

export const MODEL_FAMILIES = {

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    // Matches: claude-sonnet-4, claude-opus-4.6, claude-haiku-5, sonnet-4, opus, etc.
    pattern: /claude|anthropic|sonnet|opus|haiku/i,
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
    tiers: {
      opus:   { role: 'flagship', costTrend: 'premium', typical: { costPer1M: 15.00, contextWindow: 200000 } },
      sonnet: { role: 'balanced', costTrend: 'mid',     typical: { costPer1M: 3.00,  contextWindow: 200000 } },
      haiku:  { role: 'fast',     costTrend: 'budget',  typical: { costPer1M: 0.80,  contextWindow: 200000 } },
    },
    defaultTier: 'sonnet',
    // Version pattern: claude-{tier}-{version} or claude-{version}-{tier}
    versionExtractor: /(?:claude-)?(?:(opus|sonnet|haiku)-?([\d.]+)|([\d.]+)-?(opus|sonnet|haiku))/i,
  },

  'openai-gpt': {
    id: 'openai-gpt',
    name: 'OpenAI GPT',
    // Matches: gpt-4o, gpt-4.1, gpt-5.1-mini, gpt-7-nano, chatgpt, etc.
    pattern: /gpt-?\d|chatgpt/i,
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
      '':     { role: 'flagship', costTrend: 'mid',    typical: { costPer1M: 2.50, contextWindow: 128000 } },
      'mini': { role: 'fast',     costTrend: 'budget', typical: { costPer1M: 0.40, contextWindow: 128000 } },
      'nano': { role: 'edge',     costTrend: 'cheap',  typical: { costPer1M: 0.10, contextWindow: 128000 } },
    },
    defaultTier: '',
    versionExtractor: /gpt-?([\d.]+[a-z]?)(?:-(mini|nano))?/i,
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
    versionExtractor: /^o(\d+)(?:-(mini|pro))?$/i,
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
      'pro':   { role: 'flagship', costTrend: 'mid',     typical: { costPer1M: 1.25,  contextWindow: 1000000 } },
      'flash': { role: 'fast',     costTrend: 'budget',  typical: { costPer1M: 0.075, contextWindow: 1000000 } },
      'ultra': { role: 'premium',  costTrend: 'premium', typical: { costPer1M: 7.00,  contextWindow: 2000000 } },
    },
    defaultTier: 'pro',
    versionExtractor: /gemini-?([\d.]+)(?:-(pro|flash|ultra))?/i,
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
    versionExtractor: /deepseek-?(?:v?([\d.]+))?(?:-(coder|chat))?/i,
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
    versionExtractor: /llama-?([\d.]+)?/i,
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
    versionExtractor: /(?:mistral|codestral|mixtral)-?([\d.]+)?(?:-(large|small))?/i,
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
    versionExtractor: /qwen-?([\d.]+)?(?:-(coder|max))?/i,
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
    versionExtractor: /command-?r?-?(?:plus)?-?([\d.]+)?/i,
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
    versionExtractor: /grok-?([\d.]+)?(?:-(mini))?/i,
  },
};

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

  const name = modelName.trim();

  for (const [id, fam] of Object.entries(MODEL_FAMILIES)) {
    if (!fam.pattern.test(name)) continue;

    let tier = fam.defaultTier || '';
    let version = null;

    // Try structured extraction with the family-specific pattern
    if (fam.versionExtractor) {
      const match = name.match(fam.versionExtractor);
      if (match) {
        if (id === 'anthropic') {
          // claude-{tier}-{version} or claude-{version}-{tier}
          tier = (match[1] || match[4] || fam.defaultTier || '').toLowerCase();
          version = match[2] || match[3] || null;
        } else if (id === 'openai-reasoning') {
          version = match[1] || null;
          tier = (match[2] || '').toLowerCase();
        } else {
          // Standard: version in group 1, tier in group 2
          version = match[1] || null;
          tier = (match[2] || fam.defaultTier || '').toLowerCase();
        }
      }
    }

    return { family: id, tier, version, familyDef: fam };
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
    case 'qwen':              return 'open-source';
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
