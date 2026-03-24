// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Token Budget Analyzer — pre-session intelligence.
 *
 * Shows users exactly where their tokens are going BEFORE they start
 * a coding session. Identifies optimization opportunities and compares
 * models side by side.
 *
 * This is the intelligence layer that no other tool provides.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { resolveModel, getCharsPerToken } from './families.js';
import { getModelCost, getContextWindow, getAllModelCosts } from './registry.js';
import { PROVIDER_SPECS } from './specs.js';
import { analyzeProject, estimateTokens, formatTokens, formatBytes } from './tokens.js';

// ── Budget Analysis ─────────────────────────────────────────────────────────

/**
 * Generate a complete token budget report for a model/provider.
 *
 * @param {string} projectRoot - Project root path
 * @param {object} config      - Loaded cortex config
 * @param {string} modelName   - Target model (e.g., 'claude-sonnet-4.6')
 * @param {string} providerSlug - Target provider (e.g., 'claude')
 * @returns {object} Full budget analysis
 */
export function analyzeBudget(projectRoot, config, modelName, providerSlug) {
  const resolved = resolveModel(modelName);
  const contextWindow = getContextWindow(modelName);
  const costPer1M = getModelCost(modelName);
  const cpt = getCharsPerToken(modelName);

  // Get provider spec for pre-allocated files
  const spec = providerSlug ? PROVIDER_SPECS[providerSlug] : null;

  // 1. Measure pre-allocated context (always-loaded instruction files)
  const preAllocated = measurePreAllocated(projectRoot, spec, cpt);

  // 2. Measure project context
  const projectAnalysis = analyzeProject(projectRoot, config.context || {});
  // Re-estimate with model-specific tokenizer
  const projectTokens = Math.ceil(projectAnalysis.totalSize / cpt);

  // 3. Calculate available budget
  const totalPreAllocated = preAllocated.reduce((sum, f) => sum + f.tokens, 0);
  const remainingTokens = contextWindow - totalPreAllocated;

  // 4. Estimate conversation capacity
  const avgExchangeTokens = 1200; // Typical request+response
  const estimatedExchanges = Math.floor(remainingTokens / avgExchangeTokens);
  const remainingChars = remainingTokens * cpt;

  // 5. Cost estimates
  const costPerLoad = (totalPreAllocated / 1_000_000) * costPer1M;
  const avgSessionLoads = 3;
  const costPerSession = costPerLoad * avgSessionLoads;
  const sessionsPerMonth = 20;
  const costPerMonth = costPerSession * sessionsPerMonth;

  // 6. Find optimization opportunities
  const optimizations = findOptimizations(projectRoot, config, projectAnalysis, totalPreAllocated, contextWindow, modelName, costPer1M);

  // 7. Cross-model comparison
  const comparison = compareAcrossModels(totalPreAllocated, cpt, projectAnalysis.totalSize);

  return {
    model: {
      name: modelName,
      family: resolved.family,
      tier: resolved.tier,
      version: resolved.version,
      contextWindow,
      costPer1M,
    },
    preAllocated: {
      files: preAllocated,
      totalTokens: totalPreAllocated,
      percentage: contextWindow > 0 ? (totalPreAllocated / contextWindow * 100).toFixed(1) : '0',
    },
    projectContext: {
      textFiles: projectAnalysis.textFiles,
      binaryFiles: projectAnalysis.binaryFiles,
      totalSize: projectAnalysis.totalSize,
      totalTokens: projectTokens,
      byExtension: projectAnalysis.byExtension,
      largestFiles: projectAnalysis.largestFiles,
    },
    available: {
      tokens: remainingTokens,
      percentage: contextWindow > 0 ? (remainingTokens / contextWindow * 100).toFixed(1) : '100',
      characters: remainingChars,
      estimatedExchanges,
    },
    cost: {
      perLoad: costPerLoad,
      perSession: costPerSession,
      perMonth: costPerMonth,
    },
    optimizations,
    comparison,
  };
}

// ── Pre-Allocated Measurement ───────────────────────────────────────────────

function measurePreAllocated(projectRoot, spec, cpt) {
  if (!spec) return [];

  const files = [];
  for (const cf of spec.contextFiles || []) {
    if (!cf.alwaysLoaded) continue;

    const filePath = cf.location === 'project_root'
      ? join(projectRoot, cf.path.replace('{name}', '*'))
      : cf.path;

    // Only measure actual files, not patterns
    if (filePath.includes('{') || filePath.includes('*')) continue;

    const resolved = filePath.startsWith('~/')
      ? join(homedir(), filePath.slice(2))
      : filePath;

    try {
      if (existsSync(resolved)) {
        const content = readFileSync(resolved, 'utf-8');
        const tokens = Math.ceil(content.length / cpt);
        files.push({
          path: cf.path,
          tokens,
          size: content.length,
          purpose: cf.purpose || '',
        });
      }
    } catch {}
  }

  return files;
}

// ── Optimization Detection ──────────────────────────────────────────────────

function findOptimizations(projectRoot, config, analysis, preAllocatedTokens, contextWindow, modelName, costPer1M) {
  const opts = [];

  // Check for large files that could be excluded
  const excludePatterns = config.context?.exclude || [];
  const includePatterns = config.context?.include || [];

  // Check if common large files are included
  const largeExcludeCandidates = [
    { pattern: 'package-lock.json', label: 'package-lock.json' },
    { pattern: 'yarn.lock', label: 'yarn.lock' },
    { pattern: 'pnpm-lock.yaml', label: 'pnpm-lock.yaml' },
    { pattern: 'dist/', label: 'dist/' },
    { pattern: 'build/', label: 'build/' },
    { pattern: '.next/', label: '.next/' },
    { pattern: 'coverage/', label: 'coverage/' },
  ];

  for (const candidate of largeExcludeCandidates) {
    const isExcluded = excludePatterns.some(p => p.includes(candidate.pattern));
    if (isExcluded) continue;

    const targetPath = join(projectRoot, candidate.pattern);
    try {
      if (existsSync(targetPath)) {
        const content = readFileSync(targetPath, 'utf-8');
        const tokens = Math.ceil(content.length / 4.0); // Default estimation
        if (tokens > 1000) {
          opts.push({
            type: 'exclude_file',
            severity: tokens > 5000 ? 'high' : 'medium',
            message: `${candidate.label} is in context — exclude to save ~${formatTokens(tokens)} tokens`,
            savings: tokens,
          });
        }
      }
    } catch {}
  }

  // Check for large individual files
  for (const file of (analysis.largestFiles || []).slice(0, 5)) {
    if (file.tokens > 5000) {
      opts.push({
        type: 'large_file',
        severity: 'medium',
        message: `${file.path} is ${formatTokens(file.tokens)} tokens — consider splitting or summarizing`,
        savings: 0, // Not automatic
      });
    }
  }

  // Budget vs. window check
  if (preAllocatedTokens > contextWindow * 0.5) {
    opts.push({
      type: 'budget_warning',
      severity: 'high',
      message: `Pre-allocated context uses ${(preAllocatedTokens / contextWindow * 100).toFixed(0)}% of window — consider reducing instruction files`,
      savings: 0,
    });
  }

  // Suggest cheaper model alternatives
  const allCosts = getAllModelCosts();
  const cheaperModels = Object.entries(allCosts)
    .filter(([name, cost]) => cost > 0 && cost < costPer1M * 0.5 && name !== modelName)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2);

  for (const [altModel, altCost] of cheaperModels) {
    const savings = ((costPer1M - altCost) / costPer1M * 100).toFixed(0);
    opts.push({
      type: 'cheaper_model',
      severity: 'info',
      message: `${altModel} costs $${altCost}/1M (${savings}% cheaper). May lose some capabilities.`,
      savings: 0,
    });
  }

  return opts;
}

// ── Cross-Model Comparison ──────────────────────────────────────────────────

function compareAcrossModels(preAllocatedTokens, currentCpt, totalProjectSize) {
  // Compare representative models from different families
  const representatives = [
    { name: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
    { name: 'claude-opus-4.6',   label: 'Claude Opus 4.6' },
    { name: 'gpt-5.1',           label: 'GPT-5.1' },
    { name: 'gpt-5.1-mini',      label: 'GPT-5.1 Mini' },
    { name: 'gemini-3.3-pro',    label: 'Gemini 3.3 Pro' },
    { name: 'gemini-3.2-flash',  label: 'Gemini 3.2 Flash' },
    { name: 'o4-mini',            label: 'o4-mini' },
    { name: 'deepseek-v3',        label: 'DeepSeek V3' },
  ];

  return representatives.map(rep => {
    const cpt = getCharsPerToken(rep.name);
    const tokens = Math.ceil(totalProjectSize / cpt) + preAllocatedTokens;
    const cost = getModelCost(rep.name);
    const window = getContextWindow(rep.name);
    const costPerLoad = (tokens / 1_000_000) * cost;
    const headroom = window > 0 ? ((window - tokens) / window * 100).toFixed(1) : '0';

    return {
      model: rep.name,
      label: rep.label,
      tokens,
      costPerLoad,
      contextWindow: window,
      headroom: `${headroom}%`,
      fits: tokens <= window,
    };
  });
}
