// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Inline Tips Engine — model-specific advice injected after compile.
 *
 * Each model family has unique prompting best practices. After compiling,
 * this module analyzes the compiled output and context to generate
 * actionable tips the user can apply immediately.
 *
 * Tips are categorized by severity:
 *   - critical: Will cause problems (e.g., reasoning model with CoT instructions)
 *   - warning:  Suboptimal pattern detected
 *   - info:     Opportunity to improve
 */

import { resolveModel, getModelStrategy, getCharsPerToken } from './families.js';
import { getContextWindow, getModelCost } from './registry.js';
import { estimateTokens } from './tokens.js';
import { PROVIDER_SPECS } from './specs.js';

/**
 * Generate tips for a compile result targeting a specific model+provider.
 *
 * @param {string} compiledContent - The compiled output text
 * @param {string} modelName       - Target model (e.g., 'claude-sonnet-4')
 * @param {string} providerSlug    - Target provider (e.g., 'cursor')
 * @param {object} options         - { rules, config }
 * @returns {Array<{severity, category, message, action}>}
 */
export function generateTips(compiledContent, modelName, providerSlug, options = {}) {
  const tips = [];
  const resolved = resolveModel(modelName);
  const strategy = getModelStrategy(modelName);
  const spec = providerSlug ? PROVIDER_SPECS[providerSlug] : null;
  const cpt = getCharsPerToken(modelName);
  const contextWindow = getContextWindow(modelName);
  const tokens = Math.ceil(compiledContent.length / cpt);

  // ── Family-specific tips ──────────────────────────────────────────────

  if (resolved.family === 'openai-reasoning') {
    tips.push(...reasoningModelTips(compiledContent, modelName));
  }

  if (resolved.family === 'anthropic') {
    tips.push(...claudeTips(compiledContent, modelName));
  }

  if (resolved.family === 'openai-gpt') {
    tips.push(...gptTips(compiledContent, modelName));
  }

  if (resolved.family === 'gemini') {
    tips.push(...geminiTips(compiledContent, modelName));
  }

  if (['deepseek', 'meta-llama', 'mistral', 'qwen'].includes(resolved.family)) {
    tips.push(...openSourceTips(compiledContent, modelName));
  }

  // ── Provider-specific tips ────────────────────────────────────────────

  if (spec) {
    tips.push(...providerTips(compiledContent, spec, providerSlug, tokens));
  }

  // ── Universal tips ────────────────────────────────────────────────────

  tips.push(...universalTips(compiledContent, tokens, contextWindow, modelName));

  // ── Rule quality tips ─────────────────────────────────────────────────

  if (options.rules) {
    tips.push(...ruleQualityTips(options.rules));
  }

  return tips;
}

// ── Reasoning Model Tips (o1, o3, o4-mini, etc.) ────────────────────────────

function reasoningModelTips(content, modelName) {
  const tips = [];

  // CoT instructions are counterproductive for reasoning models
  if (/think step.?by.?step|chain.?of.?thought|let'?s think/i.test(content)) {
    tips.push({
      severity: 'critical',
      category: 'prompting',
      message: `${modelName} does chain-of-thought internally. Remove "think step by step" instructions — they degrade performance.`,
      action: 'Remove chain-of-thought prompts from rules',
    });
  }

  // Over-scaffolding hurts reasoning models
  const sectionCount = (content.match(/^##\s/gm) || []).length;
  if (sectionCount > 8) {
    tips.push({
      severity: 'warning',
      category: 'structure',
      message: `${sectionCount} sections detected. Reasoning models perform better with concise problem statements, not detailed scaffolding.`,
      action: 'Consolidate sections — state constraints clearly, let the model reason',
    });
  }

  // XML tags are not helpful for OpenAI reasoning models
  if (/<[a-z_]+>[\s\S]*?<\/[a-z_]+>/i.test(content)) {
    tips.push({
      severity: 'warning',
      category: 'format',
      message: `XML tags detected. ${modelName} prefers plain markdown over XML structure.`,
      action: 'Switch to markdown headers for section organization',
    });
  }

  return tips;
}

// ── Claude Tips ─────────────────────────────────────────────────────────────

function claudeTips(content, modelName) {
  const tips = [];

  // Claude benefits from XML structure
  const hasXml = /<[a-z_]+>[\s\S]*?<\/[a-z_]+>/i.test(content);
  if (!hasXml && content.length > 500) {
    tips.push({
      severity: 'info',
      category: 'format',
      message: 'Claude responds better to XML-structured instructions. Consider wrapping sections in XML tags.',
      action: 'Cortex already formats for Claude — verify provider is set to claude',
    });
  }

  // Claude prefill technique
  if (/respond with|output format|your response should/i.test(content)) {
    tips.push({
      severity: 'info',
      category: 'prompting',
      message: 'Claude supports response prefilling. For structured output, start the assistant turn with the expected format.',
      action: 'Add prefill examples in skills for consistent output format',
    });
  }

  return tips;
}

// ── GPT Tips ────────────────────────────────────────────────────────────────

function gptTips(content, modelName) {
  const tips = [];

  // GPT works better with system prompt separation
  if (content.length > 3000 && !(content.startsWith('## ') || content.startsWith('# '))) {
    tips.push({
      severity: 'info',
      category: 'structure',
      message: 'GPT models respond best to clearly numbered instructions with markdown headers.',
      action: 'Ensure rules use numbered lists and ## section headers',
    });
  }

  // JSON mode hint
  if (/json|structured.?output/i.test(content)) {
    tips.push({
      severity: 'info',
      category: 'prompting',
      message: `${modelName} supports JSON mode. Use structured output for consistent formatting.`,
      action: 'Enable JSON mode in API calls when structured output is needed',
    });
  }

  return tips;
}

// ── Gemini Tips ─────────────────────────────────────────────────────────────

function geminiTips(content, modelName) {
  const tips = [];

  // Gemini benefits from context-first structure
  const contextBeforeRules = content.indexOf('<context') < content.indexOf('## ');
  if (content.includes('## ') && !content.includes('<context') && content.length > 1000) {
    tips.push({
      severity: 'info',
      category: 'structure',
      message: 'Gemini performs best when context is provided before instructions. Consider context-first ordering.',
      action: 'Move project context and environment info before coding rules',
    });
  }

  // Gemini has very large context windows
  const resolved = resolveModel(modelName);
  if (resolved.tier === 'pro' || resolved.tier === 'ultra') {
    tips.push({
      severity: 'info',
      category: 'context',
      message: `${modelName} has a 1M+ token context window. You can include more project files and documentation.`,
      action: 'Consider expanding include patterns in config to provide more context',
    });
  }

  return tips;
}

// ── Open Source Tips ────────────────────────────────────────────────────────

function openSourceTips(content, modelName) {
  const tips = [];

  // Open source models need explicit instructions
  if (!/important|must|always|never|strictly/i.test(content)) {
    tips.push({
      severity: 'warning',
      category: 'prompting',
      message: `${modelName} follows instructions more reliably with explicit emphasis (IMPORTANT, MUST, ALWAYS).`,
      action: 'Add emphasis markers to critical rules',
    });
  }

  // Shorter context is better for most open source models
  if (content.length > 8000) {
    tips.push({
      severity: 'warning',
      category: 'budget',
      message: `${content.length} chars of instructions may overwhelm ${modelName}. Open source models perform better with concise rules.`,
      action: 'Prioritize your most important rules and reduce total instruction length',
    });
  }

  return tips;
}

// ── Provider-Specific Tips ──────────────────────────────────────────────────

function providerTips(content, spec, providerSlug, tokens) {
  const tips = [];

  // Token budget overflow
  const budget = spec.tokenLimits?.instructionBudget;
  if (budget && tokens > budget) {
    tips.push({
      severity: 'critical',
      category: 'budget',
      message: `Compiled output (${tokens} tokens) exceeds ${spec.name}'s budget (${budget} tokens). Rules will be truncated.`,
      action: `Reduce rules or run \`cortex optimize --provider ${providerSlug}\` to compress`,
    });
  }

  // Cursor context rot
  if (spec.features?.contextRot) {
    tips.push({
      severity: 'info',
      category: 'workflow',
      message: `${spec.name} quality degrades after ~${spec.bestPractices?.freshChatThreshold || 20} messages. Start fresh chats regularly.`,
      action: 'Add a reminder rule about starting fresh chats',
    });
  }

  // MDC format tips
  if (spec.features?.mdcFormat && providerSlug === 'cursor') {
    tips.push({
      severity: 'info',
      category: 'format',
      message: 'Cursor supports .mdc files with glob-based rule targeting. You can scope rules to specific file types.',
      action: 'Use `cortex add rule --glob "*.tsx"` for component-specific rules',
    });
  }

  // Sandbox awareness
  if (spec.features?.sandboxed) {
    tips.push({
      severity: 'info',
      category: 'workflow',
      message: `${spec.name} runs in a sandbox. Network-dependent operations may need explicit permission.`,
      action: 'Document sandbox permissions in rules if your workflow needs network access',
    });
  }

  return tips;
}

// ── Universal Tips ──────────────────────────────────────────────────────────

function universalTips(content, tokens, contextWindow, modelName) {
  const tips = [];

  // Context utilization
  if (contextWindow > 0) {
    const utilizationPct = (tokens / contextWindow) * 100;

    if (utilizationPct > 80) {
      tips.push({
        severity: 'warning',
        category: 'budget',
        message: `Instructions use ${utilizationPct.toFixed(0)}% of context window. Little room for conversation.`,
        action: 'Run `cortex optimize` to compress instructions or switch to a larger context model',
      });
    }

    if (utilizationPct < 5 && tokens < 200) {
      tips.push({
        severity: 'info',
        category: 'coverage',
        message: 'Very few rules defined. AI output will rely mostly on defaults.',
        action: 'Run `cortex learn` to auto-detect project conventions, or `cortex add rule` to add custom rules',
      });
    }
  }

  // Duplicate detection
  const lines = content.split('\n').filter(l => l.trim().startsWith('- '));
  const seen = new Set();
  let dupes = 0;
  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    if (seen.has(normalized)) dupes++;
    seen.add(normalized);
  }
  if (dupes > 0) {
    tips.push({
      severity: 'warning',
      category: 'quality',
      message: `${dupes} duplicate rule(s) detected in compiled output. Duplicates waste tokens.`,
      action: 'Remove duplicate rules from .cortex/rules/ files',
    });
  }

  // Contradictory rules detection (simple heuristic)
  const contradictions = detectContradictions(lines);
  if (contradictions.length > 0) {
    tips.push({
      severity: 'warning',
      category: 'quality',
      message: `Possible contradictory rules detected: ${contradictions[0]}`,
      action: 'Review and resolve conflicting rules in .cortex/rules/',
    });
  }

  return tips;
}

// ── Rule Quality Tips ───────────────────────────────────────────────────────

function ruleQualityTips(rules) {
  const tips = [];

  // Vague rules
  const vaguePatterns = /^(be good|do better|write clean|make it work|be careful|try to)/i;
  const vagueRules = rules.filter(r => vaguePatterns.test(r.content));
  if (vagueRules.length > 0) {
    tips.push({
      severity: 'warning',
      category: 'quality',
      message: `${vagueRules.length} vague rule(s) detected (e.g., "${vagueRules[0].content.slice(0, 50)}"). Specific rules produce better results.`,
      action: 'Replace vague rules with specific, actionable instructions',
    });
  }

  // Very long individual rules
  const longRules = rules.filter(r => r.content.length > 500);
  if (longRules.length > 0) {
    tips.push({
      severity: 'info',
      category: 'quality',
      message: `${longRules.length} rule(s) exceed 500 characters. Consider splitting into focused sub-rules.`,
      action: 'Break long rules into bullet-point sub-rules for better model parsing',
    });
  }

  return tips;
}

// ── Contradiction Detection ─────────────────────────────────────────────────

function detectContradictions(lines) {
  const contradictions = [];
  const pairs = [
    [/always use semicolons/i, /never use semicolons|no semicolons/i],
    [/use tabs/i, /use spaces|no tabs/i],
    [/single quotes/i, /double quotes/i],
    [/always add comments/i, /avoid comments|no comments/i],
    [/use any.?type/i, /never use any|avoid any/i],
    [/class.?based|use classes/i, /functional|no classes|avoid classes/i],
  ];

  const lineTexts = lines.map(l => l.trim());
  for (const [patternA, patternB] of pairs) {
    const hasA = lineTexts.some(l => patternA.test(l));
    const hasB = lineTexts.some(l => patternB.test(l));
    if (hasA && hasB) {
      contradictions.push(`"${patternA.source}" vs "${patternB.source}"`);
    }
  }

  return contradictions;
}

/**
 * Format tips for terminal display.
 */
export function formatTipsForDisplay(tips) {
  if (tips.length === 0) return '';

  const lines = [''];
  const icons = { critical: '🔴', warning: '🟡', info: '💡' };

  const grouped = { critical: [], warning: [], info: [] };
  for (const tip of tips) {
    (grouped[tip.severity] || grouped.info).push(tip);
  }

  for (const severity of ['critical', 'warning', 'info']) {
    const group = grouped[severity];
    if (group.length === 0) continue;

    for (const tip of group) {
      lines.push(`  ${icons[severity]} ${tip.message}`);
      if (tip.action) {
        lines.push(`     → ${tip.action}`);
      }
    }
  }

  return lines.join('\n');
}
